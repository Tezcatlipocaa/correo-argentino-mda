export interface DetailColumnFlags {
  hasInvgate: boolean;
  hasInfo: boolean;
  contactsCount: number;
  hasSiblings: boolean;
  hasAssets: boolean;
}

export interface DetailColumnLayout {
  hasLeft: boolean;
  hasCenter: boolean;
  hasRight: boolean;
  leftClass: string;
  centerClass: string;
  rightClass: string;
  contactsToCenter: boolean;
  compactAssets: boolean;
}

export function getDetailColumnLayout(
  flags: DetailColumnFlags,
): DetailColumnLayout {
  const contactsToCenter = flags.contactsCount > 5;
  const leftContacts = flags.contactsCount > 0 && !contactsToCenter;

  const hasLeft = flags.hasInvgate || flags.hasInfo || leftContacts;
  const hasCenter = flags.hasSiblings || contactsToCenter;
  const hasRight = flags.hasAssets;

  const columnCount = (hasLeft ? 1 : 0) + (hasCenter ? 1 : 0) + (hasRight ? 1 : 0);

  let leftClass = "";
  let centerClass = "";
  let rightClass = "";

  if (columnCount === 1) {
    if (hasLeft) leftClass = "w-full";
    if (hasCenter) centerClass = "w-full";
    if (hasRight) rightClass = "w-full";
  } else if (hasLeft && hasCenter && hasRight) {
    leftClass = "lg:flex-[2]";
    centerClass = "lg:flex-[1]";
    rightClass = "lg:flex-[2]";
  } else if (hasLeft && hasRight) {
    leftClass = "lg:w-2/5";
    rightClass = "lg:w-3/5";
  } else if (hasLeft && hasCenter) {
    leftClass = "lg:flex-[3]";
    centerClass = "lg:flex-[2]";
  } else if (hasCenter && hasRight) {
    centerClass = "lg:flex-[2]";
    rightClass = "lg:flex-[3]";
  }

  return {
    hasLeft,
    hasCenter,
    hasRight,
    leftClass,
    centerClass,
    rightClass,
    contactsToCenter,
    compactAssets: hasCenter,
  };
}
