

var TitleId = 0;
var BodyPostId = 1;

interface Post {
  postId: number;
  parentId: number;
  multireplyPostIds: number[];
  authorId: string;
  authorFullName: string;
  authorUsername: string
  createdAt: number;
  lastEditAppliedAt: number;
  numEditors: number;
  numLikeVotes: number;
  numWrongVotes: number;
  numOffTopicVotes: number;
  numPendingEditSuggestions: number;
  isTreeDeleted: boolean;
  isPostDeleted: boolean;
  isTreeCollapsed: boolean;
  isPostCollapsed: boolean;
  isTreeClosed: boolean;
  isApproved: boolean;
  pinnedPosition: number;
  likeScore: number;
  childIdsSorted: number[];
  sanitizedHtml: string;
}


