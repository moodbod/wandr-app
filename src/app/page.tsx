import ExplorePage from "@/components/ExplorePage";

type HomeProps = {
  searchParams?: {
    destination?: string | string[];
  };
};

export default function Home({ searchParams }: HomeProps) {
  const destination =
    typeof searchParams?.destination === "string" ? searchParams.destination : searchParams?.destination?.[0];

  return <ExplorePage initialDestinationId={destination} />;
}
