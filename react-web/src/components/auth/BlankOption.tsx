/**
 * The blank entry a select carries while its required field is unanswered.
 *
 * It is `hidden`, so it leaves the open list and cannot be chosen again once
 * an answer is given — an unanswered field is distinguishable from an answered
 * one, and there is no way back to blank (§9). A selected hidden option still
 * renders as the closed select's own value, which is how `label` is read:
 * the prompt, and the loading, error or "choose the one above first" text
 * these selects carry, all still show before the list is opened.
 *
 * `label` is therefore computed once by the caller and passed in, rather than
 * being asked for twice — once to decide `hidden` and again for the content.
 * With no label the option is an empty placeholder, hidden outright.
 */
export function BlankOption({ label }: { label?: string }) {
  return (
    <option value="" hidden={!label}>
      {label ?? ""}
    </option>
  );
}
