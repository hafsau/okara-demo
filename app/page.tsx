import { FirstSixty } from "@/components/onboarding/first-sixty";

export default async function Home({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const url = typeof sp.url === "string" ? sp.url.slice(0, 200) : "";
  return <FirstSixty initialUrl={url} autoExample={"example" in sp} />;
}
