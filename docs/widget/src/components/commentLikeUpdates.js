export function canUpdateLikesInPlace(previousComments, nextComments) {
  if (!Array.isArray(previousComments) || !Array.isArray(nextComments) || previousComments.length !== nextComments.length) {
    return false;
  }

  return previousComments.every((previousComment, index) => {
    const nextComment = nextComments[index];
    if (!previousComment || !nextComment || previousComment.id !== nextComment.id) {
      return false;
    }

    const keys = new Set([...Object.keys(previousComment), ...Object.keys(nextComment)]);
    for (const key of keys) {
      if (key === 'likes' || key === 'replies') {
        continue;
      }
      if (!Object.is(previousComment[key], nextComment[key])) {
        return false;
      }
    }

    return canUpdateLikesInPlace(previousComment.replies || [], nextComment.replies || []);
  });
}

export function updateCommentLikesInPlace(commentItems, comments) {
  comments.forEach((comment) => {
    commentItems.get(comment.id).updateCommentLikes(comment);
  });
}
