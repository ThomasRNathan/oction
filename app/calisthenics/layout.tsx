import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Street Workout — carte mondiale",
  description:
    "Carte interactive des parcs Street Workout et calisthenics dans le monde — données calisthenics-parks.com.",
};

export default function CalisthenicsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
