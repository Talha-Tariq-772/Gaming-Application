import type { ReactElement, ReactNode } from "react";

/**
 * For inspecting the JSX an async Server Component returns when called
 * directly (React elements are plain objects before rendering — no
 * renderer/testing-library needed to walk them).
 */

/** Collects every string/number leaf in a React element tree — used to assert on visible text. */
export function collectText(node: ReactNode, acc: string[] = []): string[] {
  if (node == null || typeof node === "boolean") return acc;
  if (typeof node === "string" || typeof node === "number") {
    acc.push(String(node));
    return acc;
  }
  if (Array.isArray(node)) {
    node.forEach((child) => collectText(child, acc));
    return acc;
  }
  const element = node as ReactElement<{ children?: ReactNode }>;
  if (element.props && "children" in element.props) {
    collectText(element.props.children, acc);
  }
  return acc;
}

/** Finds the first element of a given component type anywhere in the tree, returning it (so its props can be inspected). */
export function findElementOfType<P>(node: ReactNode, type: unknown): ReactElement<P> | null {
  if (node == null || typeof node === "boolean" || typeof node === "string" || typeof node === "number") {
    return null;
  }
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findElementOfType<P>(child, type);
      if (found) return found;
    }
    return null;
  }
  const element = node as ReactElement<P & { children?: ReactNode }>;
  if (element.type === type) return element as ReactElement<P>;
  if (element.props && "children" in element.props) {
    return findElementOfType<P>(element.props.children, type);
  }
  return null;
}

/** Finds every element of a given component type anywhere in the tree. */
export function findAllElementsOfType<P>(node: ReactNode, type: unknown, acc: ReactElement<P>[] = []): ReactElement<P>[] {
  if (node == null || typeof node === "boolean" || typeof node === "string" || typeof node === "number") {
    return acc;
  }
  if (Array.isArray(node)) {
    node.forEach((child) => findAllElementsOfType<P>(child, type, acc));
    return acc;
  }
  const element = node as ReactElement<P & { children?: ReactNode }>;
  if (element.type === type) acc.push(element as ReactElement<P>);
  if (element.props && "children" in element.props) {
    findAllElementsOfType<P>(element.props.children, type, acc);
  }
  return acc;
}
