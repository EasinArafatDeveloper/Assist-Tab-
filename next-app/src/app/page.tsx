import Image from "next/image";

export default function Home() {
  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      backgroundColor: "#0b0f19",
      backgroundImage: "radial-gradient(circle at 10% 20%, rgba(56, 189, 248, 0.05) 0%, transparent 40%), radial-gradient(circle at 90% 80%, rgba(99, 102, 241, 0.05) 0%, transparent 40%)",
      color: "#f8fafc",
      fontFamily: "'Outfit', 'Inter', sans-serif"
    }}>
      {/* HEADER */}
      <header style={{
        padding: "20px 40px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
        background: "rgba(11, 15, 25, 0.75)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        position: "sticky",
        top: 0,
        zIndex: 100
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <Image src="/icon-128.png" alt="AssistTab Logo" width={42} height={42} style={{ borderRadius: "10px", boxShadow: "0 0 15px rgba(56, 189, 248, 0.3)" }} />
          <span style={{
            fontSize: "24px",
            fontWeight: "800",
            letterSpacing: "0.5px",
            background: "linear-gradient(to right, #38bdf8, #6366f1)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent"
          }}>
            AssistTab
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "24px" }}>
          <a href="#features" style={{ color: "#94a3b8", fontWeight: "600", transition: "color 0.2s", textDecoration: "none", fontSize: "14px" }}>Features</a>
          <a href="#instructions" style={{ color: "#94a3b8", fontWeight: "600", transition: "color 0.2s", textDecoration: "none", fontSize: "14px" }}>How to Install</a>
          <a href="/assisttab-extension.zip" style={{
            padding: "10px 22px",
            background: "linear-gradient(135deg, #38bdf8 0%, #6366f1 100%)",
            color: "#fff",
            borderRadius: "12px",
            fontWeight: "700",
            fontSize: "14px",
            border: "none",
            boxShadow: "0 4px 20px rgba(56, 189, 248, 0.25)",
            cursor: "pointer",
            transition: "all 0.3s",
            textDecoration: "none"
          }}>Download</a>
        </div>
      </header>

      {/* HERO SECTION */}
      <main style={{ flex: 1, padding: "80px 20px 40px 20px", display: "flex", flexDirection: "column", alignItems: "center", maxWidth: "1200px", margin: "0 auto", textAlign: "center" }}>
        <div style={{ maxWidth: "850px", marginBottom: "60px" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", background: "rgba(56, 189, 248, 0.1)", border: "1px solid rgba(56, 189, 248, 0.2)", padding: "6px 16px", borderRadius: "100px", marginBottom: "24px" }}>
            <span style={{ fontSize: "12px", fontWeight: "700", textTransform: "uppercase", color: "#38bdf8", letterSpacing: "1px" }}>🚀 Version 1.0 Available</span>
          </div>
          <h1 style={{ fontSize: "62px", fontWeight: "800", lineHeight: "1.15", marginBottom: "24px", color: "#ffffff", letterSpacing: "-1px" }}>
            Your Productivity Workspace,<br />
            <span style={{ background: "linear-gradient(to right, #38bdf8, #6366f1)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Powered by Advanced AI</span>
          </h1>
          <p style={{ fontSize: "20px", color: "#94a3b8", marginBottom: "40px", fontWeight: "400", lineHeight: "1.6", maxWidth: "750px", margin: "0 auto 40px auto" }}>
            AssistTab replaces your default Chrome New Tab page with a premium productivity dashboard. Organize work priorities, track calendars, monitor web usage, and chat with AI personalized using your exact routine.
          </p>

          <div style={{ display: "flex", gap: "16px", justifyContent: "center" }}>
            <a href="/assisttab-extension.zip" style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "16px 36px",
              background: "linear-gradient(135deg, #38bdf8 0%, #6366f1 100%)",
              color: "#fff",
              borderRadius: "14px",
              fontWeight: "700",
              fontSize: "17px",
              boxShadow: "0 10px 30px rgba(56, 189, 248, 0.3)",
              transition: "all 0.3s",
              textDecoration: "none"
            }}>
              📥 Download Extension ZIP
            </a>
            <a href="#instructions" style={{
              padding: "16px 36px",
              background: "rgba(255, 255, 255, 0.03)",
              color: "#ffffff",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              borderRadius: "14px",
              fontWeight: "700",
              fontSize: "17px",
              transition: "all 0.3s",
              textDecoration: "none"
            }}>
              View Setup Instructions
            </a>
          </div>
        </div>

        {/* INTERACTIVE FEATURES GRID */}
        <section id="features" style={{ width: "100%", padding: "40px 0", marginBottom: "80px" }}>
          <h2 style={{ fontSize: "36px", fontWeight: "800", marginBottom: "16px", color: "#ffffff" }}>Key Features Overview</h2>
          <p style={{ color: "#94a3b8", fontSize: "16px", marginBottom: "48px" }}>Everything you need to organize your day, directly in every new tab page.</p>
          
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
            gap: "24px",
            width: "100%"
          }}>
            {/* FEATURE 1 */}
            <div style={{
              background: "rgba(255, 255, 255, 0.02)",
              border: "1px solid rgba(255, 255, 255, 0.05)",
              borderRadius: "20px",
              padding: "32px",
              textAlign: "left",
              transition: "all 0.3s"
            }}>
              <div style={{ fontSize: "36px", marginBottom: "16px" }}>📅</div>
              <h3 style={{ fontSize: "20px", fontWeight: "700", marginBottom: "12px", color: "#ffffff" }}>Google Calendar & Routine Sync</h3>
              <p style={{ color: "#94a3b8", fontSize: "14.5px", lineHeight: "1.6" }}>
                Add events directly on a full-size grid calendar. Set time and priority alerts, and watch today's scheduled tasks sync automatically to your daily checklist on load.
              </p>
            </div>

            {/* FEATURE 2 */}
            <div style={{
              background: "rgba(255, 255, 255, 0.02)",
              border: "1px solid rgba(255, 255, 255, 0.05)",
              borderRadius: "20px",
              padding: "32px",
              textAlign: "left",
              transition: "all 0.3s"
            }}>
              <div style={{ fontSize: "36px", marginBottom: "16px" }}>🚨</div>
              <h3 style={{ fontSize: "20px", fontWeight: "700", marginBottom: "12px", color: "#ffffff" }}>Emergency & Priority Lists</h3>
              <p style={{ color: "#94a3b8", fontSize: "14.5px", lineHeight: "1.6" }}>
                Organize checklist tasks by emergency, important, and normal priorities. Visually highlighted lists keep your attention centered on what needs immediate completion.
              </p>
            </div>

            {/* FEATURE 3 */}
            <div style={{
              background: "rgba(255, 255, 255, 0.02)",
              border: "1px solid rgba(255, 255, 255, 0.05)",
              borderRadius: "20px",
              padding: "32px",
              textAlign: "left",
              transition: "all 0.3s"
            }}>
              <div style={{ fontSize: "36px", marginBottom: "16px" }}>🔍</div>
              <h3 style={{ fontSize: "20px", fontWeight: "700", marginBottom: "12px", color: "#ffffff" }}>Multi-LLM AI Search Bar</h3>
              <p style={{ color: "#94a3b8", fontSize: "14.5px", lineHeight: "1.6" }}>
                Quick switch between Google Search, DeepSeek Chat, ChatGPT, Gemini, Claude, and Perplexity models directly from a single centralized search bar widget.
              </p>
            </div>

            {/* FEATURE 4 */}
            <div style={{
              background: "rgba(255, 255, 255, 0.02)",
              border: "1px solid rgba(255, 255, 255, 0.05)",
              borderRadius: "20px",
              padding: "32px",
              textAlign: "left",
              transition: "all 0.3s"
            }}>
              <div style={{ fontSize: "36px", marginBottom: "16px" }}>📊</div>
              <h3 style={{ fontSize: "20px", fontWeight: "700", marginBottom: "12px", color: "#ffffff" }}>Productivity Tracker</h3>
              <p style={{ color: "#94a3b8", fontSize: "14.5px", lineHeight: "1.6" }}>
                Monitor active website usage with automated tracking statistics. Interactive donut chart displays focus percentage, productive minutes, and distraction intervals.
              </p>
            </div>

            {/* FEATURE 5 */}
            <div style={{
              background: "rgba(255, 255, 255, 0.02)",
              border: "1px solid rgba(255, 255, 255, 0.05)",
              borderRadius: "20px",
              padding: "32px",
              textAlign: "left",
              transition: "all 0.3s"
            }}>
              <div style={{ fontSize: "36px", marginBottom: "16px" }}>📝</div>
              <h3 style={{ fontSize: "20px", fontWeight: "700", marginBottom: "12px", color: "#ffffff" }}>Autosaving Quick Note</h3>
              <p style={{ color: "#94a3b8", fontSize: "14.5px", lineHeight: "1.6" }}>
                Type instant drafts, links, or lists in an integrated resizable notepad. All entries are saved locally on the fly, loaded on startup, and protected with confirm prompts.
              </p>
            </div>

            {/* FEATURE 6 */}
            <div style={{
              background: "rgba(255, 255, 255, 0.02)",
              border: "1px solid rgba(255, 255, 255, 0.05)",
              borderRadius: "20px",
              padding: "32px",
              textAlign: "left",
              transition: "all 0.3s"
            }}>
              <div style={{ fontSize: "36px", marginBottom: "16px" }}>🌐</div>
              <h3 style={{ fontSize: "20px", fontWeight: "700", marginBottom: "12px", color: "#ffffff" }}>Premium Design System</h3>
              <p style={{ color: "#94a3b8", fontSize: "14.5px", lineHeight: "1.6" }}>
                Full responsive layout with custom glassmorphic styling, neon borders, and smooth micro-animations. Replaces SweetAlert with bouncy, styled Hot Toasts.
              </p>
            </div>
          </div>
        </section>

        {/* SETUP INSTRUCTIONS */}
        <section id="instructions" style={{
          width: "100%",
          padding: "48px 40px",
          textAlign: "left",
          marginBottom: "80px",
          maxWidth: "900px",
          background: "rgba(255, 255, 255, 0.01)",
          border: "1px solid rgba(255, 255, 255, 0.05)",
          borderRadius: "24px",
          boxShadow: "0 20px 40px rgba(0, 0, 0, 0.2)"
        }}>
          <h2 style={{ fontSize: "32px", fontWeight: "800", marginBottom: "28px", borderBottom: "1px solid rgba(255, 255, 255, 0.05)", paddingBottom: "16px", color: "#ffffff" }}>
            How to Load AssistTab in Google Chrome
          </h2>
          
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            <div style={{ display: "flex", gap: "16px" }}>
              <div style={{ background: "linear-gradient(135deg, #38bdf8 0%, #6366f1 100%)", color: "#fff", width: "32px", height: "32px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "700", flexShrink: 0 }}>1</div>
              <div>
                <h4 style={{ fontSize: "16px", fontWeight: "700", marginBottom: "4px", color: "#ffffff" }}>Download and Unzip</h4>
                <p style={{ color: "#94a3b8", fontSize: "14.5px" }}>Click the <strong>Download Extension ZIP</strong> button to save the zip file. Extract the ZIP file into a folder of your choice (e.g. <code style={{ background: "rgba(255, 255, 255, 0.05)", padding: "2px 6px", borderRadius: "4px", color: "#38bdf8" }}>AssistTab-Extension</code>).</p>
              </div>
            </div>
            
            <div style={{ display: "flex", gap: "16px" }}>
              <div style={{ background: "linear-gradient(135deg, #38bdf8 0%, #6366f1 100%)", color: "#fff", width: "32px", height: "32px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "700", flexShrink: 0 }}>2</div>
              <div>
                <h4 style={{ fontSize: "16px", fontWeight: "700", marginBottom: "4px", color: "#ffffff" }}>Open Chrome Extensions</h4>
                <p style={{ color: "#94a3b8", fontSize: "14.5px" }}>Open Google Chrome and navigate to <code style={{ background: "rgba(255, 255, 255, 0.05)", padding: "2px 6px", borderRadius: "4px", color: "#38bdf8" }}>chrome://extensions/</code> in your URL address bar.</p>
              </div>
            </div>
            
            <div style={{ display: "flex", gap: "16px" }}>
              <div style={{ background: "linear-gradient(135deg, #38bdf8 0%, #6366f1 100%)", color: "#fff", width: "32px", height: "32px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "700", flexShrink: 0 }}>3</div>
              <div>
                <h4 style={{ fontSize: "16px", fontWeight: "700", marginBottom: "4px", color: "#ffffff" }}>Enable Developer Mode</h4>
                <p style={{ color: "#94a3b8", fontSize: "14.5px" }}>Toggle the <strong>Developer mode</strong> switch in the top-right corner of the Extensions page to <strong>ON</strong>.</p>
              </div>
            </div>
            
            <div style={{ display: "flex", gap: "16px" }}>
              <div style={{ background: "linear-gradient(135deg, #38bdf8 0%, #6366f1 100%)", color: "#fff", width: "32px", height: "32px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "700", flexShrink: 0 }}>4</div>
              <div>
                <h4 style={{ fontSize: "16px", fontWeight: "700", marginBottom: "4px", color: "#ffffff" }}>Load Unpacked Folder</h4>
                <p style={{ color: "#94a3b8", fontSize: "14.5px" }}>Click the <strong>Load unpacked</strong> button in the top-left corner. Navigate to and select the extracted folder containing the extension files.</p>
              </div>
            </div>
          </div>
          
          <div style={{ marginTop: "32px", background: "rgba(16, 185, 129, 0.05)", border: "1px solid rgba(16, 185, 129, 0.15)", borderRadius: "12px", padding: "16px", color: "#34d399", fontSize: "14.5px", display: "flex", alignItems: "center", gap: "8px" }}>
            <span>🚀</span> <strong>Success!</strong> Open a new tab in Chrome, and AssistTab will load automatically. Configure your backend URL to this server's endpoint to sync your routines.
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer style={{
        padding: "40px 20px",
        textAlign: "center",
        borderTop: "1px solid rgba(255, 255, 255, 0.05)",
        background: "rgba(11, 15, 25, 0.75)",
        color: "#64748b",
        fontSize: "14px"
      }}>
        <p>&copy; {new Date().getFullYear()} AssistTab. Created with Next.js, MongoDB, and Advanced AI integrations.</p>
      </footer>
    </div>
  );
}
