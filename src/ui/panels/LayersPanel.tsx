import { animName } from "../util";
import { useState } from "react";
import type { El } from "../../engine/types";
import { useEditor } from "../../editor/store";
import { Icon, IconButton } from "../kit";
import { m, t, tn, type Msg } from "../../i18n";

const KIND: Record<El["type"], Msg> = { box: m("Zone"), point: m("Point"), line: m("Line"), polygon: m("Shape~kind"), image: m("Image"), path: m("Drawing") };

// A row is the name and one eye. The rest of the actions appear under the row that is selected,
// so names keep the width of the column.
function Row({ el }: { el: El }) {
  const selected = useEditor((s) => s.selectedId === el.id);
  const { select, patch, commit, reorder, remove, duplicate } = useEditor();
  const note = [el.type === "box" && el.label.show && el.borderWidth === 0 ? t("Text") : t(KIND[el.type]), el.anim.enabled ? animName(el.anim.type) : null, el.time ? `${el.time.start.toFixed(1)}s` : null].filter(Boolean).join(" · ");
  const action = "flex-1 h-9 grid place-items-center rounded-control text-fg-muted hover:bg-chip-hover hover:text-fg";
  return (
    <li className={`rounded-control ${selected ? "bg-chip-active" : "bg-chip"}`}>
      <div className="flex items-center pl-3">
        <button type="button" onClick={() => select(el.id)} aria-pressed={selected} className="flex-1 min-w-0 h-12 flex items-center gap-3 text-left">
          <span className="shrink-0 w-4 h-4 rounded-full" style={{ background: el.color, boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.18)" }} />
          <span className="min-w-0">
            <span className={`block truncate text-[14px] leading-tight ${selected ? "font-semibold" : ""} ${el.visible ? "text-fg" : "text-fg-subtle line-through"}`}>{el.name}</span>
            <span className="block truncate text-[11px] leading-tight text-fg-subtle">{note}</span>
          </span>
        </button>
        <IconButton icon={el.visible ? "eye" : "eyeOff"} label={el.visible ? t("Hide") : t("Show")} onClick={() => { patch(el.id, { visible: !el.visible }); commit(); }} className={el.visible ? "!text-fg-muted" : "!text-fg-subtle"} />
      </div>
      {selected && (
        <div className="flex gap-1 px-1 pb-1" role="group" aria-label={t("Actions for {name}", { name: el.name })}>
          <button type="button" className={action} title={t("Bring forward")} aria-label={t("Bring forward")} onClick={() => reorder(el.id, "forward")}><Icon name="up" className="w-4 h-4" /></button>
          <button type="button" className={action} title={t("Send backward")} aria-label={t("Send backward")} onClick={() => reorder(el.id, "backward")}><Icon name="down" className="w-4 h-4" /></button>
          <button type="button" className={action} title={t("Duplicate")} aria-label={t("Duplicate")} onClick={() => duplicate(el.id)}><Icon name="copy" className="w-4 h-4" /></button>
          <button type="button" className={`${action} hover:!text-danger`} title={t("Delete")} aria-label={t("Delete")} onClick={() => remove(el.id)}><Icon name="trash" className="w-4 h-4" /></button>
        </div>
      )}
    </li>
  );
}

function GroupBlock({ id, members }: { id: string; members: El[] }) {
  const name = useEditor((s) => s.scene.groups?.[id]?.name ?? t("Group"));
  const on = useEditor((s) => s.groupSel === id);
  const inside = useEditor((s) => members.some((el) => el.id === s.selectedId));
  const { selectGroup, ungroup, removeGroup } = useEditor();
  const [open, setOpen] = useState(true);
  return (
    <section aria-label={name} className={`rounded-card ${on ? "ring-1 ring-brand" : inside ? "ring-1 ring-line" : ""} bg-panel lg:bg-raised/50`}>
      <div className="flex items-center pl-3">
        <button type="button" onClick={() => selectGroup(id)} aria-pressed={on} className="flex-1 min-w-0 h-12 text-left">
          <span className={`block truncate text-[14px] font-semibold leading-tight ${on ? "text-brand" : "text-fg"}`}>{name}</span>
          <span className="block text-[11px] leading-tight text-fg-subtle">{tn(members.length, "Group · {n} overlay", "Group · {n} overlays")}</span>
        </button>
        <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-label={open ? t("Collapse {name}", { name }) : t("Expand {name}", { name })} className="w-11 h-11 grid place-items-center text-fg-muted hover:text-fg">
          <Icon name="down" className={`w-4 h-4 transition-transform ${open ? "" : "-rotate-90"}`} />
        </button>
      </div>
      {on && (
        <div className="flex gap-1 px-1 pb-1">
          <button type="button" onClick={() => ungroup(id)} className="flex-1 h-9 rounded-control text-[12px] font-semibold text-fg-muted hover:bg-chip-hover hover:text-fg">{t("Ungroup")}</button>
          <button type="button" onClick={() => removeGroup(id)} className="flex-1 h-9 rounded-control text-[12px] font-semibold text-fg-muted hover:bg-chip-hover hover:text-danger">{t("Delete group")}</button>
        </div>
      )}
      {open && <ul className="space-y-1 p-1 pt-0">{members.map((el) => <Row key={el.id} el={el} />)}</ul>}
    </section>
  );
}

/** Every overlay on the photo, top first: groups as blocks, then single overlays, then hand-drawn strokes. */
export function LayersPanel() {
  const elements = useEditor((s) => s.scene.elements);
  if (!elements.length) return <p className="text-[13px] text-fg-muted py-3">{t("No overlays yet. Tap Add, or draw one with Draw.")}</p>;

  const top = [...elements].reverse();
  const groupIds = [...new Set(top.map((el) => el.group).filter((g): g is string => !!g))];
  const loose = top.filter((el) => !el.group);
  const sections: { title: Msg; items: El[] }[] = [
    { title: m("Added"), items: loose.filter((el) => el.type !== "path") },
    { title: m("Drawn by hand"), items: loose.filter((el) => el.type === "path") },
  ];
  const heading = "mb-1.5 text-[11px] font-semibold uppercase tracking-[0.09em] text-fg-subtle";
  return (
    <div className="space-y-3">
      {groupIds.map((id) => <GroupBlock key={id} id={id} members={top.filter((el) => el.group === id)} />)}
      {sections.filter((section) => section.items.length > 0).map((section) => (
        <section key={section.title} aria-label={t(section.title)}>
          <h3 className={heading}>{t(section.title)} · {section.items.length}</h3>
          <ul className="space-y-1">{section.items.map((el) => <Row key={el.id} el={el} />)}</ul>
        </section>
      ))}
    </div>
  );
}
