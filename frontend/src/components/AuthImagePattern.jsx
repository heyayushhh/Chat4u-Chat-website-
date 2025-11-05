const AuthImagePattern = ({ subtitle }) => {
  return (
    <div className="hidden lg:flex items-center justify-center bg-base-200 p-12">
      <div className="max-w-md text-center">
        {/* Gradient framed card with embedded chat preview */}
        <div className="mx-auto mb-6 relative w-80 md:w-96 aspect-[3/4] rounded-[1.75rem] p-[3px] bg-gradient-to-br from-fuchsia-500 via-purple-500 to-blue-500">
          <div className="w-full h-full rounded-[1.6rem] bg-neutral/90 flex items-center justify-center">
            <div className="w-[85%] h-[85%] rounded-2xl bg-base-300/30 backdrop-blur-sm overflow-hidden flex flex-col">
              {/* Chat header */}
              <div className="px-3 py-2 border-b border-base-200/30 bg-base-100/10 flex items-center gap-2">
                <div className="w-6 h-6 rounded-full border border-cyan-400/60 bg-cyan-400/20" />
                <div className="text-xs font-medium">John Doe</div>
                <span className="ml-auto text-[10px] text-base-content/70">Online</span>
              </div>

              {/* Chat messages */}
              <div className="flex-1 p-3 space-y-2 bg-base-100/5">
                <div className="max-w-[75%] rounded-xl px-3 py-2 bg-base-100/15 text-[12px] text-base-content">
                  Hey! How's it going?
                </div>
                <div className="flex justify-end">
                  <div className="max-w-[75%] rounded-xl px-3 py-2 bg-primary/80 text-primary-content text-[12px]">
                    I'm doing great! Just working on some new features.
                  </div>
                </div>
                <div className="max-w-[65%] rounded-xl px-3 py-2 bg-base-100/15 text-[12px] text-base-content">
                  Let's catch up later.
                </div>
              </div>

              {/* Chat input mock */}
              <div className="p-3 border-t border-base-200/30 bg-base-100/10">
                <div className="h-8 rounded-lg bg-base-100/15" />
              </div>
            </div>
          </div>
        </div>

        {subtitle && <p className="text-sm text-base-content/60">{subtitle}</p>}
      </div>
    </div>
  );
};

export default AuthImagePattern;
