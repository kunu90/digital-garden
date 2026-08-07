"use client";

import { createContext, useContext, useReducer, useCallback } from "react";

export type Pane = {
  tabs: string[];
  activeIndex: number;
};

export const GRAPH_TAB_PATH = "__graph__";

type WorkspaceState = {
  panes: [Pane] | [Pane, Pane];
  activePaneIndex: 0 | 1;
  splitRatio: number;
};

type Action =
  | { type: "OPEN_FILE"; path: string; paneIndex?: 0 | 1 }
  | { type: "CLOSE_TAB"; path: string; paneIndex: 0 | 1 }
  | { type: "SET_ACTIVE_TAB"; path: string; paneIndex: 0 | 1 }
  | { type: "SPLIT_PANE" }
  | { type: "UNSPLIT_PANE" }
  | { type: "SET_ACTIVE_PANE"; paneIndex: 0 | 1 }
  | { type: "SET_SPLIT_RATIO"; ratio: number };

function openFileInPane(pane: Pane, path: string): Pane {
  const existingIdx = pane.tabs.indexOf(path);
  if (existingIdx !== -1) {
    return { ...pane, activeIndex: existingIdx };
  }
  return { tabs: [...pane.tabs, path], activeIndex: pane.tabs.length };
}

function closeTabInPane(pane: Pane, path: string): Pane {
  const idx = pane.tabs.indexOf(path);
  if (idx === -1) return pane;
  const newTabs = pane.tabs.filter((t) => t !== path);
  const newActive = Math.min(pane.activeIndex, Math.max(0, newTabs.length - 1));
  return { tabs: newTabs, activeIndex: newActive };
}

function reducer(state: WorkspaceState, action: Action): WorkspaceState {
  switch (action.type) {
    case "OPEN_FILE": {
      const targetPane = action.paneIndex ?? state.activePaneIndex;
      const safePane = Math.min(targetPane, state.panes.length - 1) as 0 | 1;
      const panes = state.panes.map((p, i) =>
        i === safePane ? openFileInPane(p, action.path) : p
      ) as typeof state.panes;
      return { ...state, panes, activePaneIndex: safePane };
    }
    case "CLOSE_TAB": {
      if (action.paneIndex >= state.panes.length) return state;
      const panes = state.panes.map((p, i) =>
        i === action.paneIndex ? closeTabInPane(p, action.path) : p
      ) as typeof state.panes;
      // If second pane is empty after close, remove split
      if (panes.length === 2 && panes[1].tabs.length === 0) {
        return { ...state, panes: [panes[0]], activePaneIndex: 0 };
      }
      return { ...state, panes };
    }
    case "SET_ACTIVE_TAB": {
      if (action.paneIndex >= state.panes.length) return state;
      const targetPane = state.panes[action.paneIndex];
      const idx = targetPane!.tabs.indexOf(action.path);
      if (idx === -1) return state;
      const panes = state.panes.map((p, i) =>
        i === action.paneIndex ? { ...p, activeIndex: idx } : p
      ) as typeof state.panes;
      return { ...state, panes, activePaneIndex: action.paneIndex };
    }
    case "SPLIT_PANE": {
      if (state.panes.length === 2) return state;
      const activeTab = state.panes[0].tabs[state.panes[0].activeIndex];
      const secondPane: Pane = activeTab
        ? { tabs: [activeTab], activeIndex: 0 }
        : { tabs: [], activeIndex: 0 };
      return { ...state, panes: [state.panes[0], secondPane], activePaneIndex: 1 };
    }
    case "UNSPLIT_PANE": {
      if (state.panes.length === 1) return state;
      return { ...state, panes: [state.panes[0]], activePaneIndex: 0 };
    }
    case "SET_ACTIVE_PANE": {
      if (action.paneIndex >= state.panes.length) return state;
      return { ...state, activePaneIndex: action.paneIndex };
    }
    case "SET_SPLIT_RATIO": {
      return { ...state, splitRatio: action.ratio };
    }
    default:
      return state;
  }
}

const initialState: WorkspaceState = {
  panes: [{ tabs: [], activeIndex: 0 }],
  activePaneIndex: 0,
  splitRatio: 0.5,
};

type WorkspaceContextValue = {
  panes: WorkspaceState["panes"];
  activePaneIndex: 0 | 1;
  splitRatio: number;
  isSplit: boolean;
  openFile: (path: string, paneIndex?: 0 | 1) => void;
  closeTab: (path: string, paneIndex: 0 | 1) => void;
  setActiveTab: (path: string, paneIndex: 0 | 1) => void;
  splitPane: () => void;
  unsplitPane: () => void;
  setActivePaneIndex: (paneIndex: 0 | 1) => void;
  setSplitRatio: (ratio: number) => void;
  // Backward compat
  openFilePath: string | null;
  setOpenFilePath: (path: string | null) => void;
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const openFile = useCallback((path: string, paneIndex?: 0 | 1) => {
    dispatch({ type: "OPEN_FILE", path, paneIndex });
  }, []);

  const closeTab = useCallback((path: string, paneIndex: 0 | 1) => {
    dispatch({ type: "CLOSE_TAB", path, paneIndex });
  }, []);

  const setActiveTab = useCallback((path: string, paneIndex: 0 | 1) => {
    dispatch({ type: "SET_ACTIVE_TAB", path, paneIndex });
  }, []);

  const splitPane = useCallback(() => dispatch({ type: "SPLIT_PANE" }), []);
  const unsplitPane = useCallback(() => dispatch({ type: "UNSPLIT_PANE" }), []);

  const setActivePaneIndex = useCallback((paneIndex: 0 | 1) => {
    dispatch({ type: "SET_ACTIVE_PANE", paneIndex });
  }, []);

  const setSplitRatio = useCallback((ratio: number) => {
    dispatch({ type: "SET_SPLIT_RATIO", ratio });
  }, []);

  // Backward compat: openFilePath = active file in active pane
  const activePane = state.panes[state.activePaneIndex] ?? state.panes[0];
  const openFilePath = activePane.tabs[activePane.activeIndex] ?? null;

  const setOpenFilePath = useCallback((path: string | null) => {
    if (path === null) return;
    dispatch({ type: "OPEN_FILE", path });
  }, []);

  return (
    <WorkspaceContext.Provider
      value={{
        panes: state.panes,
        activePaneIndex: state.activePaneIndex,
        splitRatio: state.splitRatio,
        isSplit: state.panes.length === 2,
        openFile,
        closeTab,
        setActiveTab,
        splitPane,
        unsplitPane,
        setActivePaneIndex,
        setSplitRatio,
        openFilePath,
        setOpenFilePath,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used within WorkspaceProvider");
  return ctx;
}
