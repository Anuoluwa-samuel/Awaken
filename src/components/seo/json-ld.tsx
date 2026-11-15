/** Renders one structured-data block. `data` must already be a plain, serialisable object
 * built from this request's own content — never from anything a visitor can influence. */
export function JsonLd({ data }: { data: object }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />;
}
