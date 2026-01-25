import React from "react";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, info: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    this.setState({ info });
    // Also log to console
    console.error("ErrorBoundary caught:", error, info);
  }

  render() {
    if (this.state.hasError) {
      const msg =
        this.state.error && this.state.error.message
          ? this.state.error.message
          : String(this.state.error || "Unknown error");
      const stack =
        this.state.error && this.state.error.stack
          ? this.state.error.stack
          : "";
      const info =
        this.state.info && this.state.info.componentStack
          ? this.state.info.componentStack
          : "";

      return (
        <div
          style={{
            padding: 16,
            fontFamily: "ui-sans-serif, system-ui",
            color: "#111",
          }}
        >
          <h2 style={{ margin: "0 0 10px" }}>App crashed after login</h2>
          <div
            style={{
              marginBottom: 10,
              color: "crimson",
              whiteSpace: "pre-wrap",
            }}
          >
            {msg}
          </div>
          {stack ? (
            <details style={{ marginBottom: 10 }}>
              <summary>Stack</summary>
              <pre style={{ whiteSpace: "pre-wrap" }}>{stack}</pre>
            </details>
          ) : null}
          {info ? (
            <details>
              <summary>Component Stack</summary>
              <pre style={{ whiteSpace: "pre-wrap" }}>{info}</pre>
            </details>
          ) : null}
        </div>
      );
    }
    return this.props.children;
  }
}
