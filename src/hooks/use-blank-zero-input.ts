"use client";

import { useState } from "react";

/**
 * Numeric input helper. While the field is focused, a zero value is shown as
 * an empty input so the user can type a fresh number without first deleting
 * the leading "0". On blur the underlying value (still 0) is shown again.
 *
 * Spread the returned props onto the <input>; keep your own onChange.
 */
export function useBlankZeroInput(value: number) {
  const [focused, setFocused] = useState(false);
  return {
    value: focused && value === 0 ? "" : value,
    onFocus: () => setFocused(true),
    onBlur: () => setFocused(false),
  };
}
