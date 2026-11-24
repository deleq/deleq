import { JsonLd } from "@/components/JsonLd";
import { Hero } from "@/components/home/Hero";
import { Benefits, Cta, Difference, Faq, GetStarted, How, Intro, Problem } from "@/components/home/Sections";
import { appLd, faqLd, HOME_DESCRIPTION, HOME_TITLE, pageMeta } from "@/lib/seo";
import { FAQ } from "@/lib/faq";

export const metadata = pageMeta({ path: "/", title: HOME_TITLE, description: HOME_DESCRIPTION });

/* Home in the UI reference's order: hero + ticker, problem, introducing (console loop), difference, how it works, benefits,
   get started, FAQ, closing call. */
export default function Home() {
  return (
    <>
      <JsonLd data={appLd} />
      <JsonLd data={faqLd(FAQ)} />
      <Hero />
      <Problem />
      <Intro />
      <Difference />
      <How />
      <Benefits />
      <GetStarted />
      <Faq />
      <Cta />
    </>
  );
}
