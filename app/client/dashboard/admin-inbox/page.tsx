import ClientSidebar from "@/components/molecules/ClientSidebar";
import AdminInboxContent from "@/components/organisms/AdminInboxContent";

export default function ClientAdminInboxPage() {
  return (
    <div className="min-h-screen bg-[#FCF9F7]">
      <main>
        <div className="w-full">
          <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr]">
            <ClientSidebar active="/client/dashboard/admin-inbox" />
            <section className="px-4 pb-10 pt-[79px] sm:px-6 lg:px-6 md:pt-6">
              <AdminInboxContent role="client" />
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
