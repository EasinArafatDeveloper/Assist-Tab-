import Image from "next/image";

export default function Home() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      {/* HEADER */}
      <header style={{
        padding: "20px 40px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        borderBottom: "1px solid rgba(15, 23, 42, 0.05)",
        background: "rgba(255, 255, 255, 0.6)",
        backdropFilter: "blur(12px)"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <Image src="/icon-128.png" alt="AssistTab Logo" width={40} height={40} className="animate-float" />
          <span style={{ fontSize: "24px", fontWeight: "800", letterSpacing: "1px", background: "linear-gradient(to right, #1d4ed8, #38bdf8)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            AssistTab
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
          <a href="#instructions" style={{ color: "#475569", fontWeight: "500", transition: "color 0.2s" }}>How to Install</a>
          <a href="/assisttab-extension.zip" style={{ 
            padding: "8px 18px", 
            background: "linear-gradient(135deg, #1d4ed8 0%, #38bdf8 100%)", 
            color: "#fff", 
            borderRadius: "8px", 
            fontWeight: "600", 
            fontSize: "14px", 
            border: "none", 
            boxShadow: "0 4px 15px rgba(29, 78, 216, 0.2)",
            cursor: "pointer", 
            transition: "all 0.3s" 
          }}>Download</a>
        </div>
      </header>

      {/* HERO SECTION */}
      <main style={{ flex: 1, padding: "80px 20px", display: "flex", flexDirection: "column", alignItems: "center", maxWidth: "1200px", margin: "0 auto", textAlign: "center" }}>
        <div className="animate-fade-in" style={{ maxWidth: "800px" }}>
          <h1 style={{ fontSize: "56px", fontWeight: "800", lineHeight: "1.2", marginBottom: "20px", color: "#0f172a" }}>
            Your Productivity Workspace,<br />
            <span style={{ background: "linear-gradient(to right, #1d4ed8, #38bdf8)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Powered by DeepSeek AI</span>
          </h1>
          <p style={{ fontSize: "20px", color: "#475569", marginBottom: "40px", fontWeight: "400", lineHeight: "1.5" }}>
            AssistTab replaces your default Chrome New Tab page with a premium productivity dashboard. Organize work priorities, track checklists, and chat with DeepSeek AI personalized using your exact routine.
          </p>

          <div style={{ display: "flex", gap: "16px", justifyContent: "center", marginBottom: "80px" }}>
            <a href="/assisttab-extension.zip" style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "16px 32px",
              background: "linear-gradient(135deg, #1d4ed8 0%, #38bdf8 100%)",
              color: "#fff",
              borderRadius: "12px",
              fontWeight: "600",
              fontSize: "18px",
              boxShadow: "0 8px 25px rgba(29, 78, 216, 0.25)",
              transition: "all 0.3s"
            }}>
              📥 Download Extension ZIP
            </a>
            <a href="#instructions" style={{
              padding: "16px 32px",
              background: "#ffffff",
              color: "#1e293b",
              border: "1px solid rgba(15, 23, 42, 0.1)",
              borderRadius: "12px",
              fontWeight: "600",
              fontSize: "18px",
              boxShadow: "0 4px 15px rgba(15, 23, 42, 0.02)",
              transition: "all 0.3s"
            }}>
              View Setup Instructions
            </a>
          </div>
        </div>

        {/* FEATURES GRID */}
        <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "24px", width: "100%", padding: "0 20px", marginBottom: "100px" }}>
          <div className="glass" style={{ padding: "32px", textAlign: "left" }}>
            <div style={{ fontSize: "36px", marginBottom: "16px" }}>🚨</div>
            <h3 style={{ fontSize: "20px", fontWeight: "700", marginBottom: "12px", color: "#0f172a" }}>Work Priority Lists</h3>
            <p style={{ color: "#475569", fontSize: "15px", lineHeight: "1.6" }}>Group and track your routines by importance: Emergency (1st), Important (2nd), and Normal (3rd) priorities to focus on what matters most.</p>
          </div>
          <div className="glass" style={{ padding: "32px", textAlign: "left" }}>
            <div style={{ fontSize: "36px", marginBottom: "16px" }}>✅</div>
            <h3 style={{ fontSize: "20px", fontWeight: "700", marginBottom: "12px", color: "#0f172a" }}>Daily Routine Checklist</h3>
            <p style={{ color: "#475569", fontSize: "15px", lineHeight: "1.6" }}>Stay organized with checklist tracking. Any routine edits or completion states sync directly to your secure MongoDB database instantly.</p>
          </div>
          <div className="glass" style={{ padding: "32px", textAlign: "left" }}>
            <div style={{ fontSize: "36px", marginBottom: "16px" }}>🤖</div>
            <h3 style={{ fontSize: "20px", fontWeight: "700", marginBottom: "12px", color: "#0f172a" }}>DeepSeek AI Assistant</h3>
            <p style={{ color: "#475569", fontSize: "15px", lineHeight: "1.6" }}>Chat with a context-aware chatbot. DeepSeek reads your upcoming classes and incomplete routine checklists to provide highly custom advice.</p>
          </div>
        </section>

        {/* SETUP INSTRUCTIONS */}
        <section id="instructions" className="glass" style={{ width: "100%", padding: "48px 40px", textAlign: "left", marginBottom: "80px", maxWidth: "900px" }}>
          <h2 style={{ fontSize: "32px", fontWeight: "800", marginBottom: "28px", borderBottom: "1px solid rgba(15, 23, 42, 0.05)", paddingBottom: "16px", color: "#0f172a" }}>
            How to Load AssistTab in Google Chrome
          </h2>
          
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            <div style={{ display: "flex", gap: "16px" }}>
              <div style={{ background: "linear-gradient(135deg, #1d4ed8 0%, #38bdf8 100%)", color: "#fff", width: "32px", height: "32px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "700", flexShrink: 0 }}>1</div>
              <div>
                <h4 style={{ fontSize: "16px", fontWeight: "700", marginBottom: "4px", color: "#0f172a" }}>Download and Unzip</h4>
                <p style={{ color: "#475569", fontSize: "14px" }}>Click the "Download Extension ZIP" button above to save the zip file. Extract the ZIP file into a folder of your choice (e.g. `AssistTab-Extension`).</p>
              </div>
            </div>
            
            <div style={{ display: "flex", gap: "16px" }}>
              <div style={{ background: "linear-gradient(135deg, #1d4ed8 0%, #38bdf8 100%)", color: "#fff", width: "32px", height: "32px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "700", flexShrink: 0 }}>2</div>
              <div>
                <h4 style={{ fontSize: "16px", fontWeight: "700", marginBottom: "4px", color: "#0f172a" }}>Open Chrome Extensions</h4>
                <p style={{ color: "#475569", fontSize: "14px" }}>Open Google Chrome and navigate to <code style={{ background: "rgba(15, 23, 42, 0.05)", padding: "2px 6px", borderRadius: "4px", color: "#0f172a" }}>chrome://extensions/</code> in your address bar.</p>
              </div>
            </div>
            
            <div style={{ display: "flex", gap: "16px" }}>
              <div style={{ background: "linear-gradient(135deg, #1d4ed8 0%, #38bdf8 100%)", color: "#fff", width: "32px", height: "32px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "700", flexShrink: 0 }}>3</div>
              <div>
                <h4 style={{ fontSize: "16px", fontWeight: "700", marginBottom: "4px", color: "#0f172a" }}>Enable Developer Mode</h4>
                <p style={{ color: "#475569", fontSize: "14px" }}>Toggle the <strong>Developer mode</strong> switch in the top-right corner of the Extensions page to ON.</p>
              </div>
            </div>
            
            <div style={{ display: "flex", gap: "16px" }}>
              <div style={{ background: "linear-gradient(135deg, #1d4ed8 0%, #38bdf8 100%)", color: "#fff", width: "32px", height: "32px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "700", flexShrink: 0 }}>4</div>
              <div>
                <h4 style={{ fontSize: "16px", fontWeight: "700", marginBottom: "4px", color: "#0f172a" }}>Load Unpacked Folder</h4>
                <p style={{ color: "#475569", fontSize: "14px" }}>Click the <strong>Load unpacked</strong> button in the top-left corner. Navigate to and select the extracted folder containing the extension files.</p>
              </div>
            </div>
          </div>
          
          <div style={{ marginTop: "32px", background: "rgba(16, 185, 129, 0.08)", border: "1px solid rgba(16, 185, 129, 0.15)", borderRadius: "8px", padding: "16px", color: "#065f46", fontSize: "14px" }}>
            🚀 <strong>Success!</strong> Open a new tab in Chrome, and AssistTab will load automatically. Configure your backend URL to this server's endpoint to sync your data.
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer style={{
        padding: "40px 20px",
        textAlign: "center",
        borderTop: "1px solid rgba(15, 23, 42, 0.05)",
        background: "rgba(255, 255, 255, 0.6)",
        color: "#64748b",
        fontSize: "14px"
      }}>
        <p>&copy; {new Date().getFullYear()} AssistTab. Created with Next.js, MongoDB, and DeepSeek AI.</p>
      </footer>
    </div>
  );
}
