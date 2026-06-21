import FreelancerSidebar from "@/components/molecules/FreelancerSidebar";
import AdminInboxContent from "@/components/organisms/AdminInboxContent";

export default function FreelancerAdminInboxPage() {
  return (
    <div className="min-h-screen bg-[#FCF9F7]">
      <main>
        <div className="w-full">
          <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
            <FreelancerSidebar active="/freelancer/dashboard/admin-inbox" />
            <section className="px-4 pb-10 pt-[79px] sm:px-6 lg:px-3 md:pt-6">
              <AdminInboxContent role="freelancer" />
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
