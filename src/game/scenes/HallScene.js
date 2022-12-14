import {Scene} from "phaser";
import socket from "@/main";


//周围的墙，静态实体组
var walls;
//游标
var cursors;
//你自己的精灵
var yourPlayer;
//接收服务器传递的在线玩家列表
var onlinePlayers = [];
//newConnectId 解决在高帧率刷新中执行过多次请求
var newConnectId;
//在线玩家精灵存储
const playerMap = new Map();
//在线人数
var playerNum;
//前台
var bar;
//公告
var notice;
//公告条数
var noticeLength = 0;

//连接服务器获取客户端id
socket.on('getClientId',msg =>{
    console.log("客户端已连接，客户端id：" + msg)
    sessionStorage.setItem('clientId',msg)
})

socket.emit('joinScene',{
    clientId: sessionStorage.getItem('clientId'),
    nowScene:1,
})

/**
 * 获取当前服务器总在线成员信息表
 * clinetId 客户端id
 * X  横坐标
 * Y  纵坐标
 * connectTime 连接时间
 */
socket.on('onlinePlayers_HALL',playerList =>{
    onlinePlayers = playerList;
    if (onlinePlayers.length < 1){
        console.log(playerList)
    }
})


export default class HallScene extends Scene {
    constructor() {
        super({key: 'HallScene'});
    }

    /**
     * 加载资源
     */
    create (){
        this.add.image(1366/2,768/2,'HallBack');
        // this.add.image(1366/2,768-30,'player').setScale(0.3);
        walls = this.physics.add.staticGroup();
        walls.create(0,768/2,'yWall');
        walls.create(1366,768/2,'yWall');
        walls.create(1366/2,0,'xWall');
        walls.create(1366/2,768,'xWall');

        // this.physics.world.gravity.set(0,300)
        //txt
        this.add.text(15, 15, '角色控制 : 方向键(仅支持PC)', { fontFamily: 'Arial', fontSize: 18, color: '#F38D72' });
        this.add.text(15, 45, '当前在线：', { fontFamily: 'Arial', fontSize: 18, color: '#885478' });
        if (onlinePlayers.length <= 0 || sessionStorage.getItem('clientId')=== null){
            playerNum = this.add.text(100, 42, '  无法连接至服务器,请刷新页面！', { fontFamily: 'Arial', fontSize: 23, color: '#EE76B1' });
        }else {
            playerNum = this.add.text(100, 42, onlinePlayers.length, { fontFamily: 'Arial', fontSize: 23, color: '#EE76B1' });
        }
        //公告
        notice = this.add.text(15,600,'',{ fontFamily: 'Arial', fontSize: 15, color: '#AFA8BA' });
        //前台
        this.physics.add.staticSprite(1366/2, 52,'long').setScale(0.1)
        bar = this.physics.add.staticSprite(1366/2,95,'bar');
        this.add.text(1366/2 - 35, 140, '前台', { fontFamily: 'Arial', fontSize: 30, color: '#AFA8BA' });
        //加载自己的精灵
        yourPlayer = this.physics.add.sprite(1366/2,768 - 30,'player');
        //弹力
        yourPlayer.setBounce(0.2);
        //世界边界
        yourPlayer.setCollideWorldBounds(true);
        //移动动画
        this.moveAnims()
        //创建游标
        cursors = this.input.keyboard.createCursorKeys();
        //自己与墙体的物理碰撞
        this.physics.add.collider(yourPlayer,walls);
        //与吧台的碰撞
        // this.physics.add.collider(yourPlayer,bar);
        this.physics.add.overlap(yourPlayer,bar,this.collectBar,null,this);

        setTimeout(()=>{
            //渲染在线玩家的精灵
            this.initOnlinePlayer();
            //获取实时在线列表
            this.getOnlinePlayersByRealTime();
            //监听其他玩家移动的消息
            this.someoneMoved();
            //新加入的玩家渲染
            this.newConnect()
            //监听其他玩家离开的消息
            this.someoneLeveled();
        },1000)
    }

    update (){
        //本地移动
        if (cursors.left.isDown){
            // yourPlayer.setVelocityX(-150)
            yourPlayer.setX(yourPlayer.x - 5)
            yourPlayer.anims.play('left',true);
            this.iMoved()
        }else if (cursors.right.isDown){
            // yourPlayer.setVelocityX(150)
            yourPlayer.setX(yourPlayer.x + 5)
            yourPlayer.anims.play('right',true);
            this.iMoved()
        }else if (cursors.up.isDown){
            // yourPlayer.setVelocityY(-150)
            yourPlayer.setY(yourPlayer.y - 5)
            yourPlayer.anims.play('up',true);
            this.iMoved()
        }else if (cursors.down.isDown){
            // yourPlayer.setVelocityY(150)
            yourPlayer.anims.play('down',true);
            yourPlayer.setY(yourPlayer.y + 5)
            this.iMoved()
        }

    }


    //向服务器告知自己移动了
    iMoved(){
        socket.emit('IMoved',{
            clientId: sessionStorage.getItem('clientId'),
            xx:yourPlayer.x,
            yy:yourPlayer.y,
            nowScene:1,
        })
    }

    //监听其他用户移动的消息
    someoneMoved(){

        socket.on('someoneMoved_HALL', player =>{
            var clientId = player.clientId;
            //过滤收到自己动的消息，自己动由本地直接渲染
            if (sessionStorage.getItem('clientId') !== clientId){
                var movedPlayer = playerMap.get(player.clientId);
                movedPlayer.setX(player.xx)
                movedPlayer.setY(player.yy)
                movedPlayer.anims.play('down',true)
            }
        })
    }

    //监听其他用户离开的消息
    someoneLeveled(){
        socket.on('someoneLeveled_HALL',clientId =>{
            console.log('客户端：' + clientId + ' 离开了房间')
            this.updateNotice('有人离开了房间')
            var player = playerMap.get(clientId);
            player.destroy()
            playerMap.delete(clientId)
        })
    }

    //新加入的玩家渲染
    newConnect(){
        //newConnectId 解决在高帧率刷新中执行过多次请求
        // newConnectId = sessionStorage.getItem('clientId');
        socket.on('newConnect_HALL',id =>{
            //过滤，避免重复渲染自己
            if (sessionStorage.getItem('clientId') !== id){
                    var player = this.physics.add.sprite(1366/2,768 - 30,'player');
                    playerMap.set(id,player);
                    console.log("有人进入房间：" + id);
                    this.updateNotice('有人进入房间')
                    // player.setBounce(0.4);
                    // player.setCollideWorldBounds(true);
                    this.physics.add.collider(yourPlayer,player);
                    newConnectId = id;
            }
        })
    }

    //初始化渲染当前在线的玩家精灵
    initOnlinePlayer(){
            console.log('准备渲染已在线玩家实体，当前在线人数：' + onlinePlayers.length )
            for (let i = 0; i < onlinePlayers.length; i++) {
                var onlinePlayer = onlinePlayers[i];
                var clientId = onlinePlayer.clientId;
                //过滤，避免重复渲染自己
                if (sessionStorage.getItem('clientId') !== clientId){
                    var player = this.physics.add.sprite(onlinePlayer.xx,onlinePlayer.yy,'player');
                    playerMap.set(clientId,player);
                    // player.setBounce(0.4);
                    // player.setCollideWorldBounds(true);
                    this.physics.add.collider(yourPlayer,player);
                    console.log("已初始化玩家：" + clientId)
                    playerNum.setText(onlinePlayers.length);
                }
            }
    }

    //实时获取在线用户列表
    getOnlinePlayersByRealTime(){
        socket.on('onlinePlayers_HALL',playerList =>{
            onlinePlayers = playerList;
            //更新在线人数
            playerNum.setText(onlinePlayers.length);
        })
    }
    someoneLevelRoom(){
        socket.on('someoneLevelRoom_HALL',id =>{
            this.updateNotice('有人前往了 其他房间')
            var player = playerMap.get(id);
            player.destroy();
            playerMap.delete(id)
        })
    }

    //碰到前台
    collectBar(){
        yourPlayer.setPosition(1366/2, 250)
        this.scene.sleep('HallScene')
        this.scene.start('Rooms')
    }

    //更新公告
    updateNotice(newNotice){
        if (noticeLength > 7){
            notice.setText('');
        }
        notice.setText(notice.text + '\n' + new Date().getHours() + ':' + new Date().getMinutes() + '  ' + newNotice);
        noticeLength ++;
    }

    //移动动画
    moveAnims(){
        this.anims.create({
            key: 'down',
            frames: this.anims.generateFrameNumbers('player',{start: 0,end: 3}),
            frameRate: 10,
            repeat: -1
        })
        this.anims.create({
            key: 'left',
            frames: this.anims.generateFrameNumbers('player',{start: 4,end: 7}),
            frameRate: 10,
            repeat: -1
        })
        this.anims.create({
            key: 'up',
            frames: this.anims.generateFrameNumbers('player',{start: 8,end: 11}),
            frameRate: 10,
            repeat: -1
        })
        this.anims.create({
            key: 'right',
            frames: this.anims.generateFrameNumbers('player',{start: 12,end: 15}),
            frameRate: 10,
            repeat: -1
        })
    }

}
