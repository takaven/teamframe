import "server-only";
/* eslint-disable @typescript-eslint/no-explicit-any -- bounded cross-table handoff preview; all returned rows are narrowed below. */
import { z } from "zod";
import type { Actor } from "@/middleware/rbac";
import { createServiceRoleClient } from "@/lib/db/supabaseServer";
import { requireCapability } from "@/lib/rbac/access";

const Period = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
export type PayrollChangePreview = { employeeId:string;employeeNumber:string|null;fullName:string;joiner:boolean;leaver:boolean;changes:string[];unpaidLeaveDays:number };

function bounds(period:string):{start:string;end:string}{const [year,month]=period.split("-").map(Number);return{start:`${period}-01`,end:new Date(Date.UTC(year!,month!,0)).toISOString().slice(0,10)};}

export async function listPayrollChanges(actor:Actor,periodInput:string):Promise<PayrollChangePreview[]>{
  await requireCapability(actor,"finance_payroll_exports");
  if(!actor.tenantId)throw new Error("NO_TENANT_CONTEXT");
  const period=Period.parse(periodInput);const {start,end}=bounds(period);const db:any=createServiceRoleClient();
  const [employeesQ,compQ,changesQ,paymentQ,leaveQ]=await Promise.all([
    db.from("employees").select("id,employee_number,full_name,start_date,end_date").eq("tenant_id",actor.tenantId).is("deleted_at",null),
    db.from("compensation_history").select("employee_id,effective_date,total_amount,currency,pay_basis").eq("tenant_id",actor.tenantId).gte("effective_date",start).lte("effective_date",end),
    db.from("employment_changes").select("employee_id,change_keys,effective_date,old_values,new_values").eq("tenant_id",actor.tenantId).eq("status","applied").gte("effective_date",start).lte("effective_date",end),
    db.from("employee_payment_details").select("employee_id,updated_at").eq("tenant_id",actor.tenantId).gte("updated_at",`${start}T00:00:00Z`).lte("updated_at",`${end}T23:59:59Z`),
    db.from("leaves").select("employee_id,requested_days,start_date,end_date").eq("tenant_id",actor.tenantId).eq("status","approved").eq("leave_type","unpaid").lte("start_date",end).gte("end_date",start),
  ]);
  const failure=[employeesQ,compQ,changesQ,paymentQ,leaveQ].find((query)=>query.error);if(failure?.error)throw new Error(`PAYROLL_CHANGES_FAILED: ${failure.error.message}`);
  const flags=new Map<string,Set<string>>();const add=(id:string,value:string)=>{const set=flags.get(id)??new Set<string>();set.add(value);flags.set(id,set);};
  for(const row of compQ.data??[])add(row.employee_id,`Compensation ${row.effective_date}: ${row.total_amount} ${row.currency} (${row.pay_basis})`);
  for(const row of changesQ.data??[])add(row.employee_id,`${row.effective_date}: ${JSON.stringify(row.old_values)} -> ${JSON.stringify(row.new_values)}`);
  for(const row of paymentQ.data??[])add(row.employee_id,"Payment details");
  const unpaid=new Map<string,number>();
  for(const row of leaveQ.data??[]){
    if(row.start_date<start||row.end_date>end){add(row.employee_id,"Cross-period unpaid leave (review)");continue;}
    unpaid.set(row.employee_id,(unpaid.get(row.employee_id)??0)+Number(row.requested_days??0));
  }
  return (employeesQ.data??[])
    .filter((employee:{start_date:string|null;end_date:string|null})=>(!employee.start_date||employee.start_date<=end)&&(!employee.end_date||employee.end_date>=start))
    .map((employee:{id:string;employee_number:string|null;full_name:string;start_date:string|null;end_date:string|null})=>({employeeId:employee.id,employeeNumber:employee.employee_number,fullName:employee.full_name,joiner:Boolean(employee.start_date&&employee.start_date>=start&&employee.start_date<=end),leaver:Boolean(employee.end_date&&employee.end_date>=start&&employee.end_date<=end),changes:Array.from(flags.get(employee.id)??[]).sort(),unpaidLeaveDays:unpaid.get(employee.id)??0})).filter((row:PayrollChangePreview)=>row.joiner||row.leaver||row.changes.length>0||row.unpaidLeaveDays>0).sort((a:PayrollChangePreview,b:PayrollChangePreview)=>a.fullName.localeCompare(b.fullName));
}
