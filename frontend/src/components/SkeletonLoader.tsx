import styles from "../styles/components/SkeletonLoader.module.css";

interface SkeletonLoaderProps {
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
  count?: number;
  className?: string;
}

export const SkeletonLoader = ({
  width = "100%",
  height = "20px",
  borderRadius = "8px",
  count = 1,
  className = "",
}: SkeletonLoaderProps) => {
  const skeletons = Array.from({ length: count });

  return (
    <>
      {skeletons.map((_, index) => (
        <div
          key={index}
          className={`${styles.skeleton} ${className}`}
          style={{
            width,
            height,
            borderRadius,
          }}
        />
      ))}
    </>
  );
};

export const SkeletonCard = () => {
  return (
    <div className={styles.skeletonCard}>
      <SkeletonLoader width="60%" height="24px" borderRadius="8px" />
      <SkeletonLoader width="80%" height="20px" borderRadius="8px" />
      <SkeletonLoader width="100%" height="8px" borderRadius="4px" />
      <SkeletonLoader width="70%" height="18px" borderRadius="6px" />
    </div>
  );
};
