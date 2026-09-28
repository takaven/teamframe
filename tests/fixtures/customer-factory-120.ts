/** Deterministic, synthetic setup pack for measuring the unchanged parser. */
export function customerFactory120Pack() {
  const emails = Array.from({ length: 120 }, (_, index) =>
    `person${String(index + 1).padStart(3, "0")}@launch-test.invalid`,
  );
  const departments = ["Operations", "Engineering", "Product", "Sales", "Customer Success", "Finance"];
  const employeesCsv = emails.map((email, index) => {
    const row = Array<string>(33).fill("");
    row[1] = `Synthetic Person ${String(index + 1).padStart(3, "0")}`;
    row[3] = email;
    row[9] = index < 12 ? "Team Lead" : "Specialist";
    row[10] = departments[index % departments.length]!;
    row[11] = index < 12 ? "" : emails[Math.floor((index - 12) / 9)]!;
    row[12] = index < 116 ? "2024-01-15" : "2026-10-15";
    row[13] = "full_time";
    row[14] = index < 116 ? "existing" : "new_starter";
    row[19] = index < 116 ? "2" : "0";
    return row.join(",");
  }).join("\n");

  return {
    companyCsv: "Synthetic Launch Company,IN,Mumbai,20,10,Asia/Kolkata,Mon Tue Wed Thu Fri,SYN,-,4,1",
    usersCsv: "Synthetic Full Access,operator@launch-test.invalid,no,full_access",
    employeesCsv,
    holidaysCsv: "2026-01-01,Synthetic New Year\n2026-12-25,Synthetic Holiday",
    accessExceptionsCsv: "",
  };
}
