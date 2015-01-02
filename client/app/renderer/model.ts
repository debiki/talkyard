

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


interface User {
  userId: string;
  isLoggedIn?: boolean;
  isAdmin?: boolean;
  username?: string;
  fullName?: string;
  rolePageSettings: any;
  votes: any;
  unapprovedPosts: any;
  postIdsAutoReadLongAgo: number[];
  postIdsAutoReadNow: number[];
  marksByPostId: { [postId: number]: any };
}


interface Store {
  now: number;
  pageId: string;
  pageRole: string;
  numPosts: number;
  numPostsExclTitle: number;
  isInEmbeddedCommentsIframe: boolean;
  categories: any; // number[]?
  user: User;
  userSpecificDataAdded?: boolean;
  rootPostId: number;
  allPosts: { [postId: number]: any };
  topLevelCommentIdsSorted: number[];
  horizontalLayout: boolean;
  socialLinksHtml: string;
}
