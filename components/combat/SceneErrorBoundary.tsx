"use client";

import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}
interface State {
  error: Error | null;
}

const cinzel = { fontFamily: "var(--font-cinzel), serif" };

// Catches runtime errors thrown anywhere inside the 3D scene tree (R3F /
// Three.js shadow + env-map setup, shader compilation, geometry assembly,
// etc.) so a single crash doesn't tear down the whole combat board.
//
// Fallback renders a black plate with a short notice in place of the scene;
// the board's own panels / bezel / End-Turn button remain mounted as
// siblings of <Scene>, so the rest of the HUD stays usable and the user can
// still End Turn or refresh.
export default class SceneErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string }): void {
    console.error("[combat scene] crashed:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black gap-3 px-6 text-center">
          <p
            className="text-sm tracking-[0.4em] uppercase text-red-300/80"
            style={cinzel}
          >
            3D scene failed to render
          </p>
          <p
            className="text-[10px] tracking-[0.25em] uppercase text-white/40"
            style={cinzel}
          >
            Refresh the page to retry — combat state is preserved on the server
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}
