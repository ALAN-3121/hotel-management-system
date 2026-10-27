-- =============================================================
-- 云栖酒店客房管理系统 —— MySQL 建表脚本
-- 数据库：hotel_system   字符集：utf8mb4
-- 说明：本脚本可直接在 Navicat / MySQL 命令行中整体执行
-- =============================================================

CREATE DATABASE IF NOT EXISTS hotel_system
  DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
USE hotel_system;

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS bookings;
DROP TABLE IF EXISTS room_images;
DROP TABLE IF EXISTS rooms;
DROP TABLE IF EXISTS room_types;
DROP TABLE IF EXISTS users;
SET FOREIGN_KEY_CHECKS = 1;

-- -------------------------------------------------------------
-- 1. 用户表：管理员 admin / 个人用户 guest
--    vip_level：0 普通 1 银卡 2 金卡（决定折扣与退房宽限时间）
-- -------------------------------------------------------------
CREATE TABLE users (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  username    VARCHAR(50)  NOT NULL UNIQUE COMMENT '登录账号',
  password    VARCHAR(100) NOT NULL COMMENT 'bcrypt 哈希，禁止明文存储',
  real_name   VARCHAR(50)  NOT NULL COMMENT '真实姓名',
  phone       VARCHAR(20)  DEFAULT NULL,
  role        ENUM('admin','guest') NOT NULL DEFAULT 'guest',
  vip_level   TINYINT      NOT NULL DEFAULT 0,
  created_at  DATETIME     NOT NULL,
  INDEX idx_users_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户表';

-- -------------------------------------------------------------
-- 2. 房型表
--    discount_vip1 / discount_vip2 为不同 VIP 等级的折扣系数
-- -------------------------------------------------------------
CREATE TABLE room_types (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  name           VARCHAR(50)   NOT NULL COMMENT '房型名称',
  price          DECIMAL(10,2) NOT NULL COMMENT '门市价/晚',
  capacity       TINYINT       NOT NULL DEFAULT 2 COMMENT '可住人数',
  bed_type       VARCHAR(30)   DEFAULT NULL COMMENT '床型',
  area           SMALLINT      DEFAULT NULL COMMENT '面积（㎡）',
  cover_img      VARCHAR(200)  DEFAULT NULL COMMENT '封面图',
  intro          VARCHAR(500)  DEFAULT NULL COMMENT '房型介绍',
  features       VARCHAR(200)  DEFAULT NULL COMMENT '设施标签，逗号分隔',
  discount_vip1  DECIMAL(3,2)  NOT NULL DEFAULT 0.95,
  discount_vip2  DECIMAL(3,2)  NOT NULL DEFAULT 0.90,
  sort           TINYINT       NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='房型表';

-- -------------------------------------------------------------
-- 3. 客房表：同一房型下的具体房间（物理房间）
--    status：idle 空闲 / booked 已预订 / occupied 入住中
--            cleaning 待清洁 / maintenance 维修停用
-- -------------------------------------------------------------
CREATE TABLE rooms (
  id       INT AUTO_INCREMENT PRIMARY KEY,
  room_no  VARCHAR(10) NOT NULL UNIQUE COMMENT '房间号',
  type_id  INT         NOT NULL,
  floor    TINYINT     NOT NULL DEFAULT 1,
  status   ENUM('idle','booked','occupied','cleaning','maintenance')
           NOT NULL DEFAULT 'idle',
  CONSTRAINT fk_rooms_type FOREIGN KEY (type_id) REFERENCES room_types(id),
  INDEX idx_rooms_type (type_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='客房表';

-- -------------------------------------------------------------
-- 4. 房型图片表：kind = photo（多角度实拍） / panorama（360°全景）
--    这是"指定设计：VR 看房"的数据来源
-- -------------------------------------------------------------
CREATE TABLE room_images (
  id       INT AUTO_INCREMENT PRIMARY KEY,
  type_id  INT          NOT NULL,
  url      VARCHAR(200) NOT NULL,
  caption  VARCHAR(50)  DEFAULT NULL COMMENT '图片说明',
  kind     ENUM('photo','panorama') NOT NULL DEFAULT 'photo',
  sort     TINYINT      NOT NULL DEFAULT 0,
  CONSTRAINT fk_images_type FOREIGN KEY (type_id) REFERENCES room_types(id),
  INDEX idx_images_type (type_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='房型图片表';

-- -------------------------------------------------------------
-- 5. 订单表
--    status：pending 已预订 / checked_in 入住中
--            checked_out 已退房 / cancelled 已取消
--    amount      下单时预估金额
--    final_amount 退房结算金额（含超时加收）
-- -------------------------------------------------------------
CREATE TABLE bookings (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  order_no       VARCHAR(24)   NOT NULL UNIQUE COMMENT '订单号',
  user_id        INT           NOT NULL,
  room_id        INT           NOT NULL,
  type_id        INT           NOT NULL,
  check_in       DATE          NOT NULL COMMENT '入住日期',
  check_out      DATE          NOT NULL COMMENT '离店日期',
  guests         TINYINT       NOT NULL DEFAULT 1,
  status         ENUM('pending','checked_in','checked_out','cancelled')
                 NOT NULL DEFAULT 'pending',
  amount         DECIMAL(10,2) NOT NULL DEFAULT 0,
  final_amount   DECIMAL(10,2) DEFAULT NULL,
  remark         VARCHAR(200)  DEFAULT NULL,
  created_at     DATETIME      NOT NULL,
  checked_in_at  DATETIME      DEFAULT NULL,
  checked_out_at DATETIME      DEFAULT NULL,
  CONSTRAINT fk_bookings_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_bookings_room FOREIGN KEY (room_id) REFERENCES rooms(id),
  CONSTRAINT fk_bookings_type FOREIGN KEY (type_id) REFERENCES room_types(id),
  INDEX idx_bookings_room_date (room_id, check_in, check_out),
  INDEX idx_bookings_user (user_id),
  INDEX idx_bookings_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='订单表';
