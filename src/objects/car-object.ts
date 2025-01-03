import { HitboxObject } from "./common/hitbox-object.js";
import { BaseDynamicCollidableGameObject } from "./base/base-collidable-dynamic-game-object.js";
import { WebRTCPeer } from "../interfaces/webrtc-peer.js";
import { GamePlayer } from "../models/game-player.js";
import {
  BLUE_TEAM_TRANSPARENCY_COLOR,
  RED_TEAM_TRANSPARENCY_COLOR,
} from "../constants/colors-constants.js";
import {
  SCALE_FACTOR_FOR_ANGLES,
  SCALE_FACTOR_FOR_SPEED,
} from "../constants/webrtc-constants.js";

export class CarObject extends BaseDynamicCollidableGameObject {
  protected readonly TOP_SPEED: number = 4;
  protected readonly ACCELERATION: number = 0.4;
  protected readonly HANDLING: number = 0.0698132;
  protected readonly WIDTH: number = 50;
  protected readonly HEIGHT: number = 50;

  protected canvas: HTMLCanvasElement | null = null;
  protected speed: number = 0;

  private readonly IMAGE_BLUE_PATH = "./images/car-blue.png";
  private readonly IMAGE_RED_PATH = "./images/car-red.png";

  private readonly MASS: number = 500;
  private readonly DISTANCE_CENTER: number = 220;
  private readonly FRICTION: number = 0.2;

  private readonly PLAYER_NAME_PADDING = 10;
  private readonly PLAYER_NAME_RECT_HEIGHT = 24;
  private readonly PLAYER_NAME_RADIUS = 10;

  private readonly PING_CIRCLE_RADIUS = 3;
  private readonly PING_CIRCLE_SPACING = 4;
  private readonly PING_ACTIVE_COLOR = "#C6FF00";
  private readonly PING_INACTIVE_COLOR = "#FF0000";

  private carImage: HTMLImageElement | null = null;
  private imagePath = this.IMAGE_BLUE_PATH;

  constructor(x: number, y: number, angle: number, private remote = false) {
    super();
    this.x = x;
    this.y = y;
    this.angle = angle;
    this.mass = this.MASS;

    if (remote) {
      this.imagePath = this.IMAGE_RED_PATH;
    }

    this.addCollisionExclusion(CarObject);
  }

  public override load(): void {
    this.createHitbox();
    this.loadCarImage();
  }

  public override reset(): void {
    this.angle = 1.5708;
    this.speed = 0;
    this.setCenterPosition();
    super.reset();
  }

  public override serialize(): ArrayBuffer {
    const buffer = new ArrayBuffer(8);
    const dataView = new DataView(buffer);
    const angle = Math.round(this.angle * SCALE_FACTOR_FOR_ANGLES);
    const speed = Math.round(this.speed * SCALE_FACTOR_FOR_SPEED);

    dataView.setUint16(0, this.x);
    dataView.setUint16(2, this.y);
    dataView.setInt16(4, angle);
    dataView.setInt16(6, speed);

    return buffer;
  }

  public override sendSyncableData(
    webrtcPeer: WebRTCPeer,
    data: ArrayBuffer
  ): void {
    webrtcPeer.sendUnreliableOrderedMessage(data);
  }

  public override update(deltaTimeStamp: DOMHighResTimeStamp): void {
    this.applyFriction();
    this.calculateMovement();
    this.updateHitbox();

    super.update(deltaTimeStamp);
  }

  public override render(context: CanvasRenderingContext2D): void {
    context.save();

    context.translate(this.x + this.WIDTH / 2, this.y + this.HEIGHT / 2);
    context.rotate(this.angle);
    context.drawImage(
      this.carImage!,
      -this.WIDTH / 2,
      -this.HEIGHT / 2,
      this.WIDTH,
      this.HEIGHT
    );

    context.restore();

    this.renderPingLevel(context);
    this.renderPlayerName(context);

    // Hitbox debug
    super.render(context);
  }

  public getPlayer(): GamePlayer | null {
    return this.owner;
  }

  public setCanvas(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
  }

  public setCenterPosition(): void {
    if (this.canvas === null) {
      throw new Error("Canvas is not set");
    }

    this.x = this.canvas.width / 2 - this.WIDTH / 2;
    this.y = this.canvas.height / 2 - this.HEIGHT / 2;

    this.y += this.DISTANCE_CENTER;
  }

  private createHitbox(): void {
    this.setHitboxObjects([
      new HitboxObject(this.x, this.y, this.WIDTH, this.WIDTH),
    ]);
  }

  protected updateHitbox(): void {
    this.getHitboxObjects().forEach((object) => {
      object.setX(this.x);
      object.setY(this.y);
    });
  }

  private loadCarImage(): void {
    this.carImage = new Image();
    this.carImage.onload = () => {
      super.load();
    };

    this.carImage.src = this.imagePath;
  }

  private applyFriction(): void {
    if (this.isColliding()) {
      // We don't want the car to stop if is colliding
      // otherwise it would became stuck
      return;
    }

    if (this.speed !== 0) {
      if (Math.abs(this.speed) <= this.FRICTION) {
        this.speed = 0; // If friction would stop the car, set speed to 0
      } else {
        this.speed += -Math.sign(this.speed) * this.FRICTION;
      }
    }
  }

  private calculateMovement(): void {
    if (this.isColliding()) {
      this.speed *= -1;
    }

    this.vx = Math.cos(this.angle) * this.speed;
    this.vy = Math.sin(this.angle) * this.speed;

    this.x -= this.vx;
    this.y -= this.vy;
  }

  private renderPingLevel(context: CanvasRenderingContext2D): void {
    // Only render ping level for remote players
    if (this.owner?.isHost()) {
      return;
    }

    const pingTime = this.owner?.getPingTime() ?? null;

    if (pingTime === null) {
      return;
    }

    // Determine the number of active circles based on ping
    let activeCircles = 3; // Default to all green circles

    if (pingTime > 800) {
      activeCircles = 0;
    } else if (pingTime > 400) {
      activeCircles = 2;
    } else if (pingTime > 200) {
      activeCircles = 1;
    }

    const totalWidth =
      3 * (2 * this.PING_CIRCLE_RADIUS) + 2 * this.PING_CIRCLE_SPACING;

    const startX = this.x + this.WIDTH / 2 - totalWidth / 2 + 3;
    const startY = this.y - this.PLAYER_NAME_RECT_HEIGHT - 15;

    context.save();

    for (let i = 0; i < 3; i++) {
      const x =
        startX + i * (2 * this.PING_CIRCLE_RADIUS + this.PING_CIRCLE_SPACING);
      const color =
        i < activeCircles ? this.PING_ACTIVE_COLOR : this.PING_INACTIVE_COLOR;

      context.beginPath();
      context.arc(x, startY, this.PING_CIRCLE_RADIUS, 0, Math.PI * 2);
      context.fillStyle = color;
      context.fill();
      context.closePath();
    }

    context.restore();
  }

  private renderPlayerName(context: CanvasRenderingContext2D): void {
    context.save();

    // Retrieve the player's name or a default value
    const playerName = this.owner?.getName() ?? "Unknown";

    // Set font for measurement and rendering
    context.font = "16px system-ui";

    // Measure the text width
    const textWidth = context.measureText(playerName).width;

    // Calculate the width of the rounded rectangle
    const rectWidth = textWidth + this.PLAYER_NAME_PADDING * 1.8;

    // Set the rectangle's top-left corner position
    const rectX = this.x + this.WIDTH / 2 - rectWidth / 2;
    const rectY = this.y - this.PLAYER_NAME_RECT_HEIGHT - 5;

    // Set fill style for the rectangle
    if (this.remote) {
      context.fillStyle = RED_TEAM_TRANSPARENCY_COLOR;
    } else {
      context.fillStyle = BLUE_TEAM_TRANSPARENCY_COLOR;
    }

    // Draw the rounded rectangle
    context.beginPath();
    context.moveTo(rectX + this.PLAYER_NAME_RADIUS, rectY); // Move to the top-left arc start
    context.lineTo(rectX + rectWidth - this.PLAYER_NAME_RADIUS, rectY); // Top side
    context.arcTo(
      rectX + rectWidth,
      rectY, // Top-right corner
      rectX + rectWidth,
      rectY + this.PLAYER_NAME_RADIUS,
      this.PLAYER_NAME_RADIUS
    );
    context.lineTo(
      rectX + rectWidth,
      rectY + this.PLAYER_NAME_RECT_HEIGHT - this.PLAYER_NAME_RADIUS
    ); // Right side
    context.arcTo(
      rectX + rectWidth,
      rectY + this.PLAYER_NAME_RECT_HEIGHT, // Bottom-right corner
      rectX + rectWidth - this.PLAYER_NAME_RADIUS,
      rectY + this.PLAYER_NAME_RECT_HEIGHT,
      this.PLAYER_NAME_RADIUS
    );
    context.lineTo(
      rectX + this.PLAYER_NAME_RADIUS,
      rectY + this.PLAYER_NAME_RECT_HEIGHT
    ); // Bottom side
    context.arcTo(
      rectX,
      rectY + this.PLAYER_NAME_RECT_HEIGHT, // Bottom-left corner
      rectX,
      rectY + this.PLAYER_NAME_RECT_HEIGHT - this.PLAYER_NAME_RADIUS,
      this.PLAYER_NAME_RADIUS
    );
    context.lineTo(rectX, rectY + this.PLAYER_NAME_RADIUS); // Left side
    context.arcTo(
      rectX,
      rectY, // Top-left corner
      rectX + this.PLAYER_NAME_RADIUS,
      rectY,
      this.PLAYER_NAME_RADIUS
    );
    context.closePath();
    context.fill();

    // Set fill style for the text
    context.fillStyle = "white";
    context.textAlign = "center";
    context.textBaseline = "middle";

    // Draw the text inside the rectangle
    context.fillText(
      playerName,
      rectX + rectWidth / 2,
      rectY + this.PLAYER_NAME_RECT_HEIGHT / 2 - 0.5
    );

    context.restore();
  }
}
