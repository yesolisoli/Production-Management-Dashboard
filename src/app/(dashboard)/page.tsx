import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { AppHeader } from "@/components/layout/app-header";
import { dashboardModules } from "./dashboard-modules";

export default function DashboardHomePage() {
  return (
    <div className="flex min-h-full flex-col bg-slate-50">
      <AppHeader
        title="Dashboard"
        description="Select a module to get started."
      />

      <section className="min-h-0 flex-1 bg-slate-50 px-[3.25rem] pt-8 pb-5 lg:px-[3.75rem] lg:pt-8 lg:pb-6 xl:px-[4.25rem]">
        <div className="mx-auto flex h-full min-h-0 max-w-[1660px] overflow-visible bg-slate-50">
          <div className="grid h-full min-h-0 w-full grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4 xl:grid-rows-2 xl:gap-5">
            {dashboardModules.map((module) => {
              const Icon = module.icon;

              return (
                <Link
                  key={module.href}
                  href={module.href}
                  className={[
                    "group relative overflow-hidden rounded-[1.65rem] p-5 shadow-none ring-1 transition duration-300 hover:-translate-y-1 hover:shadow-none lg:p-6",
                    module.cardClassName,
                    module.wide
                      ? "md:col-span-2 min-h-[14rem] xl:min-h-0 xl:h-full"
                      : "min-h-[15.5rem] xl:min-h-0 xl:h-full",
                  ].join(" ")}
                >
                  <div className="relative flex h-full flex-col">
                    <div className="flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-full bg-white/95 shadow-none lg:h-20 lg:w-20">
                      <Icon className={module.iconColor} size={32} strokeWidth={2} />
                    </div>

                    <div className="mt-10 max-w-[15rem]">
                      <h2
                        className={`text-[1.2rem] leading-none font-black tracking-tight ${module.accent} lg:text-[1.4rem]`}
                      >
                        {module.title}
                      </h2>
                      <p className="mt-4 text-[0.9rem] leading-6 text-slate-700 lg:text-[0.95rem] lg:leading-7">
                        {module.description}
                      </p>
                    </div>

                    <div className="mt-auto flex justify-end pt-4">
                      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/95 shadow-none transition-transform duration-300 group-hover:translate-x-1 lg:h-16 lg:w-16">
                        <ArrowRight
                          className={module.iconColor}
                          size={26}
                          strokeWidth={2.2}
                        />
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
