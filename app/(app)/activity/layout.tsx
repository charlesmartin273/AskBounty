// Server segment wrapper: /activity itself is a client page, so the page
// title has to live here.
export const metadata = { title: "My activity" };

export default function ActivityLayout({ children }: { children: React.ReactNode }) {
  return children;
}
