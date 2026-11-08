// Structured data for search engines, rendered into the server HTML. "<" is written as its
// JSON escape so catalog text can never close the script tag.
export function JsonLd({ data }: { data: object }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}

export const ORGANIZATION = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "EGOSYNK",
  url: "https://egosynk.com/",
  logo: "https://egosynk.com/favicon.svg",
  email: "support@egosynk.com",
  address: { "@type": "PostalAddress", addressLocality: "Mumbai", addressRegion: "Maharashtra", postalCode: "400028", addressCountry: "IN" },
};
