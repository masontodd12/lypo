import { appOrigin } from "@/lib/site-url";

/**
 * Who makes Lypo, as search engines read it.
 *
 * Structured data is what lets Google connect the name "Mason Todd" to this
 * site: the Organization names its founder, and the Person points back at the
 * site and at his other profiles. Add a profile to SAME_AS (LinkedIn, X,
 * Instagram) and it strengthens the link in both directions, as long as that
 * profile links back to lypo.dev too.
 */
export const FOUNDER = "Mason Todd";

const SAME_AS = ["https://github.com/masontodd12"];

export function founderJsonLd() {
  const origin = appOrigin();
  const person = {
    "@type": "Person",
    "@id": `${origin}/about#mason-todd`,
    name: FOUNDER,
    jobTitle: "Founder",
    url: `${origin}/about`,
    sameAs: SAME_AS,
    worksFor: { "@id": `${origin}/#lypo` },
  };
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${origin}/#lypo`,
        name: "Lypo",
        url: origin,
        logo: `${origin}/icon-512.png`,
        founder: { "@id": person["@id"] },
      },
      person,
    ],
  };
}

/** The tag itself. `<` escaped so nothing in the data can close the script. */
export function FounderJsonLd() {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(founderJsonLd()).replace(/</g, "\\u003c"),
      }}
    />
  );
}
