import AppLayout from "@/components/layout/AppLayout";
import BannerCarousel from "@/components/dashboard/BannerCarousel";
import UpscalerArcanoCard from "@/components/dashboard/UpscalerArcanoCard";

const Dashboard = () => {
  return (
    <AppLayout>
      <div className="p-4 md:p-6 lg:p-8">
        <div className="max-w-5xl mx-auto space-y-6">
          {/* Banner Carousel */}
          <BannerCarousel />

          {/* Membership Products Section */}
          <div>
            <h2 className="text-lg font-semibold text-foreground mb-4">Tus Productos</h2>
            <div className="grid grid-cols-1 gap-4">
              <UpscalerArcanoCard />
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default Dashboard;
