import { getDashboardCars } from "@/lib/data/cars";
import { DashboardHome } from "@/components/dashboard/dashboard-home";

export default async function DashboardPage() {
  const data = await getDashboardCars();
  return <DashboardHome data={data} />;
}
