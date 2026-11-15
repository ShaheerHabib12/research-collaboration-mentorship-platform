import { PATHS } from '../lib/iconPaths.js';

/** Inline SVG icon. The path data is a static constant (never user input). */
export default function Icon({ name, size, className = '' }) {
  const body = PATHS[name] || PATHS['help-circle'];
  return (
    <svg className={'icon' + (size ? ' ' + size : '') + (className ? ' ' + className : '')} viewBox="0 0 24 24" aria-hidden="true" focusable="false"
      dangerouslySetInnerHTML={{ __html: body }} />
  );
}
