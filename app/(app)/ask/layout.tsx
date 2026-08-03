// Server segment wrapper: /ask itself is a client page, so the page title
// has to live here.
export const metadata = { title: "Ask a question" };

export default function AskLayout({ children }: { children: React.ReactNode }) {
  return children;
}
