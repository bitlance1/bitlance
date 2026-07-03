import ClientSidebar from "@/components/molecules/ClientSidebar";
import ClientProfileContent from "@/components/organisms/ClientProfileContent";

export default function ClientProfilePage() {
  return (
    <div className="min-h-screen bg-[#FCF9F7]">
      <main>
        <div className="w-full">
          <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-8">
            <ClientSidebar active="/client/dashboard/profile" />
            <section className="px-4 pb-10 pt-6 sm:px-6 lg:px-8 md:pt-6">
              <ClientProfileContent />
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
