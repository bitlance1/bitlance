import ClientSidebar from "@/components/molecules/ClientSidebar";
import ClientJobPostsContent from "@/components/organisms/ClientJobPostsContent";

export default function ClientJobPostsPage() {
  return (
    <div className="min-h-screen bg-[#FCF9F7]">
      <main>
        <div className="w-full">
          <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-8">
            <ClientSidebar active="/client/dashboard/job-posts" />
            <section className="px-4 pb-10 pt-6 sm:px-6 lg:px-8 md:pt-6">
              <ClientJobPostsContent />
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
