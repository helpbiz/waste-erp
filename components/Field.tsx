// Design Ref: §2 — 공용 Field 컴포넌트 (cloneElement + useId로 시맨틱 label association)
// Plan SC: FR-01, FR-02, FR-03
import { useId, cloneElement, Children, isValidElement, type ReactNode, type ReactElement } from 'react';

type FieldProps = {
  label: string;
  children: ReactNode;
  hint?: string;
  colSpan?: number;
  required?: boolean;
  /** 페이지별 라벨 스타일 보존을 위한 className 오버라이드. 미지정 시 기본 스타일 적용. */
  labelClassName?: string;
};

const DEFAULT_LABEL_CN = 'block text-[0.6875rem] font-extrabold text-ink mb-1.5 tracking-wide';

/** 다중 children 중 첫 form element(input/select/textarea)에 id 주입 — 라벨 association */
function injectIdIntoFirstFormElement(children: ReactNode, id: string): ReactNode {
  let injected = false;
  return Children.map(children, (child) => {
    if (injected) return child;
    if (!isValidElement(child)) return child;
    const type = child.type;
    if (typeof type !== 'string') return child;
    if (type !== 'input' && type !== 'select' && type !== 'textarea') return child;
    injected = true;
    const existingId = (child.props as { id?: string }).id;
    return cloneElement(child as ReactElement<{ id?: string }>, { id: existingId ?? id });
  });
}

export function Field({
  label,
  children,
  hint,
  colSpan,
  required,
  labelClassName,
}: FieldProps) {
  const fallbackId = useId();
  return (
    <div className={colSpan === 2 ? 'col-span-2' : undefined}>
      <label htmlFor={fallbackId} className={labelClassName ?? DEFAULT_LABEL_CN}>
        {label}
        {required && <span className="text-danger ml-1">*</span>}
      </label>
      {injectIdIntoFirstFormElement(children, fallbackId)}
      {hint && <span className="text-[0.625rem] font-mono text-ink-muted mt-1 block">{hint}</span>}
    </div>
  );
}
