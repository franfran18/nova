import { useState, useRef, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import styles from "../styles/components/CustomDatePicker.module.css";

interface CustomDatePickerProps {
  value: string;
  onChange: (date: string) => void;
  disabled?: boolean;
}

export const CustomDatePicker = ({
  value,
  onChange,
  disabled = false,
}: CustomDatePickerProps) => {
  // Helper to parse "YYYY-MM-DD" string in local time
  const parseLocalDate = (dateString: string): Date => {
    const [year, month, day] = dateString.split("-").map(Number);
    return new Date(year, month - 1, day);
  };

  const [isOpen, setIsOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(
    value ? parseLocalDate(value) : new Date()
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

  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  const daysInMonth = getDaysInMonth(currentMonth);
  const firstDay = getFirstDayOfMonth(currentMonth);
  const days: (number | null)[] = Array(firstDay).fill(null);

  for (let i = 1; i <= daysInMonth; i++) {
    days.push(i);
  }

  const handlePrevMonth = () => {
    setCurrentMonth(
      new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1)
    );
  };

  const handleNextMonth = () => {
    setCurrentMonth(
      new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1)
    );
  };

  const handleSelectDay = (day: number) => {
    const selected = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth(),
      day
    );
    const year = selected.getFullYear();
    const month = String(selected.getMonth() + 1).padStart(2, "0");
    const date = String(selected.getDate()).padStart(2, "0");
    const dateString = `${year}-${month}-${date}`;
    onChange(dateString);
    setIsOpen(false);
  };

  const isToday = (day: number) => {
    const today = new Date();
    return (
      day === today.getDate() &&
      currentMonth.getMonth() === today.getMonth() &&
      currentMonth.getFullYear() === today.getFullYear()
    );
  };

  const isSelected = (day: number) => {
    if (!value) return false;
    const selectedDate = parseLocalDate(value);
    return (
      day === selectedDate.getDate() &&
      currentMonth.getMonth() === selectedDate.getMonth() &&
      currentMonth.getFullYear() === selectedDate.getFullYear()
    );
  };

  const isPast = (day: number) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const checkDate = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth(),
      day
    );
    return checkDate < today;
  };

  const displayValue = value
    ? parseLocalDate(value).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "Select date";

  return (
    <div
      className={styles.container}
      style={{
        paddingBottom: isOpen ? "280px" : "0px",
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
          <div className={styles.header}>
            <button
              type="button"
              onClick={handlePrevMonth}
              className={styles.navButton}
            >
              <ChevronLeft size={20} />
            </button>
            <div className={styles.monthYear}>
              {months[currentMonth.getMonth()]} {currentMonth.getFullYear()}
            </div>
            <button
              type="button"
              onClick={handleNextMonth}
              className={styles.navButton}
            >
              <ChevronRight size={20} />
            </button>
          </div>

          <div className={styles.weekDays}>
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
              <div key={day} className={styles.weekDay}>
                {day}
              </div>
            ))}
          </div>

          <div className={styles.days}>
            {days.map((day, index) => (
              <button
                key={index}
                type="button"
                onClick={() => day && handleSelectDay(day)}
                disabled={!day || isPast(day!)}
                className={`${styles.day} ${
                  isSelected(day!) ? styles.selected : ""
                } ${isToday(day!) ? styles.today : ""} ${
                  !day || isPast(day!) ? styles.disabled : ""
                }`}
              >
                {day}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
