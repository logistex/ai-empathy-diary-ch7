import {
  CRISIS_BOX_LABEL,
  CRISIS_CONTACTS,
  CRISIS_MESSAGE,
  MEDICAL_DISCLAIMER,
} from "./crisis-config";
import styles from "./CrisisBox.module.css";

/**
 * 위기 안내 상자 (PRD F5).
 * 일기의 isCrisis 가 true 일 때 공감 메시지(또는 기본 위로 문구) 위에 보여 준다.
 * 문구와 연락처는 crisis-config.ts 한곳에서 가져온다. 번호는 누르면 전화가 걸리는 tel: 링크다.
 */
export function CrisisBox({ className }: { className?: string }) {
  return (
    <section
      aria-label={CRISIS_BOX_LABEL}
      className={[styles.box, className ?? ""].filter(Boolean).join(" ")}
    >
      <p className={styles.message}>{CRISIS_MESSAGE}</p>
      <ul className={styles.contacts}>
        {CRISIS_CONTACTS.map((contact) => (
          <li key={contact.tel} className={styles.contact}>
            <div className={styles.row}>
              <span className={styles.name}>{contact.name}</span>
              <a
                className={styles.call}
                href={`tel:${contact.tel}`}
                aria-label={`${contact.name} ${contact.number} 전화 걸기`}
              >
                {contact.number}
              </a>
            </div>
          </li>
        ))}
      </ul>
      <p className={styles.disclaimer}>{MEDICAL_DISCLAIMER}</p>
    </section>
  );
}
