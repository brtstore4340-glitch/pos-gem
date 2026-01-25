// contentScript.js - Fixed version with proper error handling

console.log("📜 Content script loaded");

// ========================================
// Safe record function with validation
// ========================================
function record(data) {
  try {
    // Validate input thoroughly
    if (!data) {
      console.warn("⚠️ record() called with no data");
      return;
    }

    if (typeof data !== "object") {
      console.warn("⚠️ record() called with non-object:", typeof data);
      return;
    }

    if (!("sentence" in data)) {
      console.warn("⚠️ record() called without sentence property:", data);
      return;
    }

    if (typeof data.sentence === "undefined" || data.sentence === null) {
      console.warn("⚠️ sentence is undefined or null");
      return;
    }

    const sentence = data.sentence;
    console.log("📝 Recording sentence:", sentence);

    // Your actual recording logic here
    // TODO: Add your recording implementation
  } catch (error) {
    console.error("❌ Error in record():", error);
    console.error("Stack trace:", error.stack);
  }
}

// ========================================
// Make it globally available safely
// ========================================
if (typeof window !== "undefined") {
  window.record = record;
  console.log("✅ record() function registered globally");
}

// ========================================
// Prevent multiple loads
// ========================================
if (!window.__contentScriptLoaded) {
  window.__contentScriptLoaded = true;
  console.log("✅ Content script initialized");

  // Debug info
  console.log("🔍 Debug Info:", {
    jQueryLoaded: typeof $ !== "undefined",
    jQueryVersion: typeof $.fn !== "undefined" ? $.fn.jquery : "N/A",
    recordFunction: typeof record !== "undefined",
    windowObject: typeof window !== "undefined",
  });
} else {
  console.warn("⚠️ Content script already loaded, skipping initialization");
}

// ========================================
// Export for module systems
// ========================================
if (typeof module !== "undefined" && module.exports) {
  module.exports = { record };
}
