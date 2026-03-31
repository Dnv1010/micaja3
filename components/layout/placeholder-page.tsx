"use client";

export function PlaceholderPage({ title }: { title: string }) {
  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-950 p-6 text-zinc-100">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="mt-2 text-zinc-400">Modulo en construccion 🚧</p>
    </section>
  );
}
