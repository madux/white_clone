"use client";

import { Heart, MessageCircle, Trophy, Upload } from "lucide-react";
import type { DepartmentEngagement } from "@/lib/types";
import { EmptyState } from "../shared/EmptyState";

function rankClass(rank: number) {
  if (rank === 1) return "dept-rank-1";
  if (rank === 2) return "dept-rank-2";
  if (rank === 3) return "dept-rank-3";
  return "";
}

function normalizeRows(rows: DepartmentEngagement[]): DepartmentEngagement[] {
  const scored = rows.map((row) => ({
    ...row,
    engagement_score: row.engagement_score ?? row.uploads * 10 + row.likes * 3 + row.comments * 5,
  }));
  scored.sort((a, b) => b.engagement_score - a.engagement_score);
  const leaderScore = scored[0]?.engagement_score || 0;
  const totalScore = scored.reduce((sum, row) => sum + row.engagement_score, 0) || 1;
  return scored.map((row, index) => ({
    ...row,
    rank: row.rank ?? index + 1,
    gap_to_leader: row.gap_to_leader ?? Math.max(leaderScore - row.engagement_score, 0),
    score_share: row.score_share ?? Math.round((row.engagement_score / totalScore) * 1000) / 10,
    is_user_department: row.is_user_department,
  }));
}

export function DepartmentLeaderboard({
  rows,
  userDepartment,
  onBrowseGallery,
}: {
  rows: DepartmentEngagement[];
  userDepartment?: string | false;
  onBrowseGallery?: () => void;
}) {
  const standings = normalizeRows(rows);
  const leaderScore = standings[0]?.engagement_score || 1;
  const userRow = standings.find((row) => row.is_user_department || (userDepartment && row.department === userDepartment));

  if (!standings.length) {
    return (
      <EmptyState
        icon={Trophy}
        title="No department standings yet"
        description="Be the first to like or comment and put your department on the board."
        action={onBrowseGallery ? (
          <button type="button" className="primary-button small" onClick={onBrowseGallery}>
            Browse gallery
          </button>
        ) : undefined}
      />
    );
  }

  return (
    <div className="dept-leaderboard">
      {userRow && userRow.rank > 1 && (
        <div className="dept-you-banner">
          <strong>Your team · #{userRow.rank}</strong>
          <span>{userRow.gap_to_leader} pts to #1</span>
        </div>
      )}
      {userRow && userRow.rank === 1 && (
        <div className="dept-you-banner is-leading">
          <strong>Your team is #1</strong>
          <span>Keep the lead — like and comment to stay on top</span>
        </div>
      )}

      <div className="dept-scoring-legend">
        <span className="dept-score-chip"><Upload size={12} /> +10 upload</span>
        <span className="dept-score-chip"><Heart size={12} /> +3 like</span>
        <span className="dept-score-chip"><MessageCircle size={12} /> +5 comment</span>
        <span className="dept-score-chip muted">All-time standings</span>
      </div>

      <div className="dept-leader-list">
        {standings.slice(0, 8).map((row) => {
          const barWidth = leaderScore ? Math.max((row.engagement_score / leaderScore) * 100, 6) : 0;
          const isYou = row.is_user_department || (userDepartment && row.department === userDepartment);
          return (
            <div key={row.department} className={`dept-leader-row ${isYou ? "is-you" : ""}`}>
              <div className={`dept-rank ${rankClass(row.rank)}`}>#{row.rank}</div>
              <div className="dept-leader-main">
                <div className="dept-leader-head">
                  <div>
                    <strong>{row.department}</strong>
                    {isYou && <span className="dept-you-tag">Your team</span>}
                  </div>
                  <div className="dept-score-wrap">
                    <strong>{row.engagement_score}</strong>
                    <span>pts</span>
                  </div>
                </div>
                <div className="dept-score-bar">
                  <span style={{ width: `${barWidth}%` }} />
                </div>
                <div className="dept-stat-pills">
                  <span><Upload size={11} /> {row.uploads}</span>
                  <span><Heart size={11} /> {row.likes}</span>
                  <span><MessageCircle size={11} /> {row.comments}</span>
                  {row.rank > 1 && <span className="dept-gap">{row.gap_to_leader} behind #1</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
