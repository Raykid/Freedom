/**
 * Created by Raykid on 2016/12/22.
 */

import {CmdDict} from "./HTMLCompiler";
import {Compiler, IAres, AresCommandData} from "../Interfaces";
import {runExp} from "../Utils";

export interface Command
{
    (context?:CommandContext):void;
}

export interface CommandContext
{
    scope:any;
    target:Node;
    compiler:Compiler;
    entity:IAres;
    cmdData:AresCommandData;
    cmdDict:CmdDict;
    [name:string]:any;
}

/**
 * 提供给外部的可以注入自定义命令的接口
 * @param name
 * @param command
 */
export function addCommand(name:string, command:Command):void
{
    if(!commands[name]) commands[name] = command;
}

/** 文本域命令 */
export function textContent(context:CommandContext):void
{
    context.entity.createWatcher(context.target, context.cmdData.exp, context.scope, (value:string)=>
    {
        context.target.nodeValue = value;
    });
}

export const commands:{[name:string]:Command} = {
    /** 文本命令 */
    text: (context:CommandContext)=>
    {
        context.entity.createWatcher(context.target, context.cmdData.exp, context.scope, (value:string)=>
        {
            context.target.textContent = value;
        });
    },
    /** HTML文本命令 */
    html: (context:CommandContext)=>
    {
        context.entity.createWatcher(context.target, context.cmdData.exp, context.scope, (value:string)=>
        {
            var target:HTMLElement = context.target as HTMLElement;
            target.innerHTML = value;
            // 设置完成后需要重新编译一下当前节点的所有子节点
            var children:NodeList = target.childNodes;
            for(var i:number = 0, len:number = children.length; i < len; i++)
            {
                context.compiler.compile(children[i], context.scope);
            }
        });
    },
    /** CSS类型命令 */
    css: (context:CommandContext)=>
    {
        var target:HTMLElement = context.target as HTMLElement;
        // 记录原始class值
        var oriCls:string = target.getAttribute("class");
        // 生成订阅器
        context.entity.createWatcher(context.target, context.cmdData.exp, context.scope, (params:any)=>
        {
            if(typeof params == "string")
            {
                // 直接赋值形式
                if(oriCls) params = oriCls + " " + params;
                // 更新target节点的class属性
                target.setAttribute("class", params);
            }
            else
            {
                // 集成形式
                var arr:string[] = [];
                if(oriCls) arr.push(oriCls);
                // 遍历所有params的key，如果其表达式值为true则添加其类型
                for(var cls in params)
                {
                    if(params[cls] == true) arr.push(cls);
                }
                // 更新target节点的class属性
                if(arr.length > 0) target.setAttribute("class", arr.join(" "));
            }
        });
    },
    /** 修改任意属性命令 */
    attr: (context:CommandContext)=>
    {
        var cmdData:AresCommandData = context.cmdData;
        var target:HTMLElement = context.target as HTMLElement;
        context.entity.createWatcher(context.target, cmdData.exp, context.scope, (value:any)=>
        {
            if(cmdData.subCmd != "")
            {
                // 子命令形式
                target.setAttribute(cmdData.subCmd, value);
            }
            else
            {
                // 集成形式，遍历所有value的key，如果其表达式值为true则添加其类型
                for(var name in value)
                {
                    var value:any = value[name];
                    target.setAttribute(name, value);
                }
            }
        });
    },
    /** 绑定事件 */
    on: (context:CommandContext)=>
    {
        var cmdData:AresCommandData = context.cmdData;
        if(cmdData.subCmd != "")
        {
            var handler:Function = context.scope[cmdData.exp] || window[context.cmdData.exp];
            if(typeof handler == "function")
            {
                // 是函数名形式
                context.target.addEventListener(cmdData.subCmd, handler.bind(context.scope));
            }
            else
            {
                // 是方法执行或者表达式方式
                context.target.addEventListener(cmdData.subCmd, (evt:Event)=>
                {
                    // 创建一个临时的子域，用于保存参数
                    var scope:any = Object.create(context.scope);
                    scope.$event = evt;
                    scope.$target = context.target;
                    runExp(cmdData.exp, scope);
                });
            }
        }
    },
    /** if命令 */
    if: (context:CommandContext)=>
    {
        // 记录一个是否编译过的flag
        var compiled:boolean = false;
        // 插入一个占位元素
        var refNode:Node = document.createTextNode("");
        context.target.parentNode.insertBefore(refNode, context.target);
        // 只有在条件为true时才启动编译
        context.entity.createWatcher(context.target, context.cmdData.exp, context.scope, (value:boolean)=>
        {
            if(value == true)
            {
                // 启动编译
                if(!compiled)
                {
                    context.compiler.compile(context.target, context.scope);
                    compiled = true;
                }
                // 插入节点
                if(!context.target.parentNode)
                {
                    refNode.parentNode.insertBefore(context.target, refNode);
                }
            }
            else
            {
                // 移除元素
                if(context.target.parentNode)
                {
                    context.target.parentNode.removeChild(context.target);
                }
            }
        });
    },
    /** for命令 */
    for: (context:CommandContext)=>
    {
        var cmdData:AresCommandData = context.cmdData;
        // 解析表达式
        var reg:RegExp = /^\s*(\S+)\s+in\s+([\s\S]+?)\s*$/;
        var res:RegExpExecArray = reg.exec(cmdData.exp);
        if(!res)
        {
            console.error("for命令表达式错误：" + cmdData.exp);
            return;
        }
        var itemName:string = res[1];
        var arrName:string = res[2];
        var pNode:Node = context.target.parentNode;
        var sNode:Node = document.createTextNode("");
        var eNode:Node = document.createTextNode("");
        var range:Range = document.createRange();
        // 替换原始模板
        pNode.replaceChild(eNode, context.target);
        pNode.insertBefore(sNode, eNode);
        // 添加订阅
        context.entity.createWatcher(context.target, arrName, context.scope, (value:any)=>{
            // 清理原始显示
            range.setStart(sNode, 0);
            range.setEnd(eNode, 0);
            range.deleteContents();
            // 如果是数字，构建一个数字列表
            if(typeof value == "number")
            {
                var temp:number[] = [];
                for(var i:number = 0; i < value; i++)
                {
                    temp.push(i);
                }
                value = temp;
            }
            // 开始遍历
            var lastNode:Node = null;
            var arrLength:number = (value instanceof Array ? value.length : -1);
            for(var key in value)
            {
                // 拷贝一个target
                var newNode:Node = context.target.cloneNode(true);
                // 添加到显示里
                pNode.insertBefore(newNode, eNode);
                // 生成子域
                var newScope:any = Object.create(context.scope);
                // 这里一定要用defineProperty将目标定义在当前节点上，否则会影响context.scope
                Object.defineProperty(newScope, "$index", {
                    configurable: true,
                    enumerable: false,
                    value: (value instanceof Array ? parseInt(key) : key),
                    writable: false
                });
                // 注入上一个显示节点
                Object.defineProperty(newScope, "$last", {
                    configurable: true,
                    enumerable: false,
                    value: lastNode,
                    writable: false
                });
                // 如果是数组再添加一个数组长度
                if(arrLength >= 0)
                {
                    Object.defineProperty(newScope, "$length", {
                        configurable: true,
                        enumerable: false,
                        value: arrLength,
                        writable: false
                    });
                }
                // 注入遍历名
                Object.defineProperty(newScope, itemName, {
                    configurable: true,
                    enumerable: true,
                    value: value[key],
                    writable: false
                });
                // 开始编译新节点
                context.compiler.compile(newNode, newScope);
                // 赋值上一个节点
                lastNode = newNode;
            }
        });
    }
};