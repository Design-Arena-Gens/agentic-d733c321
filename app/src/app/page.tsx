import AsmrGenerator from "@/components/asmr-generator";

export default function Home() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-start overflow-hidden bg-gradient-to-br from-slate-950 via-violet-900 to-rose-900 px-6 py-12 text-white sm:px-10">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.12),_transparent_55%)]" />
      <div className="absolute inset-x-0 top-0 h-32 blur-3xl bg-gradient-to-r from-rose-500/40 via-indigo-500/30 to-sky-500/40" />
      <div className="relative z-10 w-full max-w-5xl">
        <header className="mb-12 space-y-4 text-center sm:text-left">
          <p className="text-sm font-medium uppercase tracking-[0.25em] text-rose-200/70">
            ASMR Studio
          </p>
          <h1 className="text-4xl font-semibold leading-tight sm:text-5xl">
            Create soothing 10-second ASMR videos and keep them in your gallery.
          </h1>
          <p className="max-w-2xl text-base text-rose-50/80 sm:text-lg">
            Tap into immersive ambient visuals and delicate audio textures. Each
            render flows straight into your gallery, ready to replay or save.
          </p>
        </header>
        <AsmrGenerator />
      </div>
    </div>
  );
}
