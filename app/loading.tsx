import { RollingLoader } from "@/components/RollingLoader";

export default function Loading() {
  return (
    <main className="tf-workspace-loading">
      <div>
        <RollingLoader />
        <p>Preparing your workspace</p>
      </div>
    </main>
  );
}
