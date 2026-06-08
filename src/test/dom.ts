// Tiny declarative element helper, so views read as nested component functions
// instead of imperative createElement / onclick / classList / disabled churn.
//
//   h("button", { class: "primary", disabled: busy, on: { click } }, "Start")
//
// - `class` sets className; `on` adds event listeners.
// - `value` / `checked` / `disabled` / `selected` are set as live DOM
//   properties (not attributes), so e.g. a <select>'s value actually selects.
// - anything else becomes an attribute (id, type, src, data-*, ...); a `true`
//   attribute renders empty, and `false` / null / undefined is omitted.
// - children may be nested arrays and falsy holes (skipped), so conditional
//   and mapped children compose without `...spread` / `.filter(Boolean)`.

export type Child = Node | string | number | null | undefined | false;
/** A child, or an arbitrarily nested array of them (flattened on append). */
export type Children = Child | Children[];

type Handlers = Partial<{
    [K in keyof HTMLElementEventMap]: (e: HTMLElementEventMap[K]) => void;
}>;

export type Props = {
    class?: string;
    on?: Handlers;
    value?: string;
    checked?: boolean;
    disabled?: boolean;
    selected?: boolean;
    [attr: string]: unknown;
};

const LIVE_PROPS = new Set(["value", "checked", "disabled", "selected"]);

export function h<K extends keyof HTMLElementTagNameMap>(
    tag: K,
    props: Props = {},
    ...children: Children[]
): HTMLElementTagNameMap[K] {
    const node = document.createElement(tag);
    for (const child of (children as unknown[]).flat(Infinity) as Child[]) {
        if (child == null || child === false) continue;
        node.append(typeof child === "number" ? String(child) : child);
    }
    // Properties are applied after children so a <select>'s `value` can resolve
    // against its just-appended <option>s.
    for (const [k, v] of Object.entries(props)) {
        if (v == null || v === false) continue;
        if (k === "on")
            for (const [ev, fn] of Object.entries(v as Handlers))
                node.addEventListener(ev, fn as EventListener);
        else if (k === "class") node.className = String(v);
        else if (LIVE_PROPS.has(k)) (node as Record<string, unknown>)[k] = v;
        else node.setAttribute(k, v === true ? "" : String(v));
    }
    return node;
}

/** Replace the app root's contents with a freshly rendered screen. */
export function mount(root: HTMLElement, screen: HTMLElement): void {
    root.replaceChildren(screen);
}
