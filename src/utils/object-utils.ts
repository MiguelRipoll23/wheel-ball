import { GameState } from "../models/game-state.js";
import { ObjectStateType } from "../enums/object-state-type.js";
import { MultiplayerGameObject } from "../interfaces/object/multiplayer-game-object.js";
import { WebRTCPeer } from "../interfaces/webrtc-peer.js";

export class ObjectUtils {
  public static handleInactiveObject(
    multiplayerObject: MultiplayerGameObject
  ): void {
    if (multiplayerObject.getState() === ObjectStateType.Inactive) {
      multiplayerObject.setRemoved(true);
    }
  }

  public static isInvalidOwner(
    webrtcPeer: WebRTCPeer,
    ownerId: string
  ): boolean {
    if (webrtcPeer.getPlayer()?.isHost()) {
      return false;
    }

    return webrtcPeer.getPlayer()?.getId() !== ownerId;
  }

  public static updateOwnerToHostForSharedObjects(
    gameState: GameState,
    multiplayerObject: MultiplayerGameObject
  ) {
    const owner = multiplayerObject.getOwner();

    if (owner !== null) {
      return;
    }

    const host = gameState.getMatch()?.getHost() ?? null;
    multiplayerObject.setOwner(host);
  }
}
