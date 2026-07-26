export function LandingFooter() {
  return (
    <footer className="bg-charcoal px-6 py-10 text-muted">
      <div className="mx-auto max-w-5xl">
        <div className="mb-9 grid grid-cols-2 gap-10 sm:grid-cols-4">
          <div>
            <div className="mb-3 flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-brand">
                <span className="text-xs font-bold text-white">D</span>
              </div>
              <span className="text-base font-bold text-white">Draftly</span>
            </div>
            <p className="max-w-[260px] text-[13px] leading-relaxed">
              Autonomous documentation engineering. Turn support conversations
              into production docs.
            </p>
          </div>

          <div>
            <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-white">
              Product
            </h4>
            <ul className="space-y-2 text-[13px]">
              <li>
                <a href="#features" className="transition-colors hover:text-white">
                  Features
                </a>
              </li>
              <li>
                <a href="#" className="transition-colors hover:text-white">
                  Changelog
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-white">
              Resources
            </h4>
            <ul className="space-y-2 text-[13px]">
              <li>
                <a href="#" className="transition-colors hover:text-white">
                  Documentation
                </a>
              </li>
              <li>
                <a href="#" className="transition-colors hover:text-white">
                  Blog
                </a>
              </li>
              <li>
                <a href="#" className="transition-colors hover:text-white">
                  Support
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-white">
              Legal
            </h4>
            <ul className="space-y-2 text-[13px]">
              <li>
                <a href="#" className="transition-colors hover:text-white">
                  Privacy
                </a>
              </li>
              <li>
                <a href="#" className="transition-colors hover:text-white">
                  Terms
                </a>
              </li>
              <li>
                <a href="#" className="transition-colors hover:text-white">
                  Security
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="flex flex-col items-center justify-between gap-2 border-t border-charcoal-light pt-6 text-xs sm:flex-row">
          <span>© 2026 Draftly. All rights reserved.</span>
          <span>Made with care for teams who ship docs.</span>
        </div>
      </div>
    </footer>
  );
}
