"use client";

export function PostCaption({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="social-post-caption">
      <strong>{title}</strong>
      {description && <p>{description}</p>}
    </div>
  );
}
