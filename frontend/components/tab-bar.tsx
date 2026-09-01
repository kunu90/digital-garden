"use client";

import { Icon } from "@/components/icon";
import { GRAPH_TAB_PATH } from "@/context/workspace-context";

type Props = {
  tabs: string[];
  activeIndex: number;
  onSelect: (path: string) => void;
  onClose: (path: string) => void;
};

function tabLabel(path: string): string {
  if (path === GRAPH_TAB_PATH) return "Graph";
  return path.split("/").pop() ?? path;
}

export function TabBar({ tabs, activeIndex, onSelect, onClose }: Props) {
  if (tabs.length === 0) return null;

  return (
    <div className="dg-tabbar">
      {tabs.map((path, i) => {
        const isActive = i === activeIndex;
        const label = tabLabel(path);
        const isGraph = path === GRAPH_TAB_PATH;
        return (
          <div
            key={path}
            className="dg-tab"
            data-active={isActive ? "true" : undefined}
            onClick={() => onSelect(path)}
            title={isGraph ? "Graph view" : path}
          >
            {isActive && <div className="dg-tab__accent" aria-hidden />}
            {isGraph && <Icon name="account_tree" size={16} className="shrink-0 opacity-70" />}
            <span className="truncate">{label}</span>
            <button
              type="button"
              className="dg-tab__close"
              onClick={(e) => {
                e.stopPropagation();
                onClose(path);
              }}
              title="Close tab"
            >
              <Icon name="close" size={16} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
