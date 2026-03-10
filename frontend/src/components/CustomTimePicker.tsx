import { useState, useRef, useEffect } from "react";
import { Clock } from "lucide-react";
import styles from "../styles/components/CustomTimePicker.module.css";

interface CustomTimePickerProps {
  value: string;
  onChange: (time: string) => void;
  disabled?: boolean;
}

export const CustomTimePicker = ({
  value,
  onChange,
  disabled = false,
}: CustomTimePickerProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [tempHour, setTempHour] = useState(
    value ? parseInt(value.split(":")[0]) : 10
  );
  const [tempMinute, setTempMinute] = useState(
    value ? parseInt(value.split(":")[1]) : 0
  );
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const inputRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      const inputRect = inputRef.current.getBoundingClientRect();
      const containerRect = inputRef.current.parentElement?.getBoundingClientRect();

      if (containerRect) {
        setPosition({
          top: inputRect.bottom - containerRect.top + 8,
          left: 0,
        });
      }
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        popoverRef.current &&
        inputRef.current &&
        !popoverRef.current.contains(event.target as Node) &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const hours = Array.from({ length: 24 }, (_, i) => i);
  const minutes = Array.from({ length: 60 }, (_, i) => i);

  const handleHourChange = (hour: number) => {
    setTempHour(hour);
    const timeString = `${String(hour).padStart(2, "0")}:${String(
      tempMinute
    ).padStart(2, "0")}`;
    onChange(timeString);
    setIsOpen(false);
  };

  const handleMinuteChange = (minute: number) => {
    setTempMinute(minute);
    const timeString = `${String(tempHour).padStart(2, "0")}:${String(
      minute
    ).padStart(2, "0")}`;
    onChange(timeString);
    setIsOpen(false);
  };

  const displayValue = `${String(tempHour).padStart(2, "0")}:${String(
    tempMinute
  ).padStart(2, "0")}`;

  return (
    <div
      className={styles.container}
      style={{
        paddingBottom: isOpen ? "240px" : "0px",
        transition: "padding-bottom 0.2s ease",
      }}
    >
      <button
        ref={inputRef}
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={styles.input}
      >
        <Clock size={18} />
        {displayValue}
      </button>

      {isOpen && (
        <div
          ref={popoverRef}
          className={styles.popover}
          style={{
            top: `${position.top}px`,
            left: `${position.left}px`,
          }}
        >
          <div className={styles.content}>
            <div className={styles.section}>
              <div className={styles.scroll}>
                {hours.map((hour) => (
                  <button
                    key={hour}
                    type="button"
                    onClick={() => handleHourChange(hour)}
                    className={`${styles.option} ${
                      hour === tempHour ? styles.selected : ""
                    }`}
                  >
                    {String(hour).padStart(2, "0")}
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.divider}>:</div>

            <div className={styles.section}>
              <div className={styles.scroll}>
                {minutes.map((minute) => (
                  <button
                    key={minute}
                    type="button"
                    onClick={() => handleMinuteChange(minute)}
                    className={`${styles.option} ${
                      minute === tempMinute ? styles.selected : ""
                    }`}
                  >
                    {String(minute).padStart(2, "0")}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
