
/**
 * 树形结构链表排序工具
 * 使用链表实现树形结构的层级排序
 */

class TreeNode {
    id: string | number;
    parentId: string | number;
    children: TreeNode[];
    next: TreeNode | null;
    visited?: boolean;
    data: ObjectType;
    constructor(id: string | number, parentId: string | number, data: ObjectType = {}) {
        this.id = id;
        this.parentId = parentId;
        this.children = [];
        this.next = null; // 链表指针
        this.data = data;
    }
}

export class TreeLinkedListSorter {

    static getParentIdObj(item: ObjectType, parentIdIn: string) {
        if (!parentIdIn) {
            return item
        }
        let parentIdLink = parentIdIn.split('.');
        return parentIdLink.reduce((prev, cur) => {
            return prev[cur];
        }, item);
    }
    /**
     * 使用链表对树形结构数组进行层级排序
     * @param {Array} array - 包含id和parentId的对象数组
     * @param {string} rootParentId - 根节点的parentId值，默认为null
     * @returns {Array} 排序后的数组
     */
    static sortByHierarchy(array: ObjectType[], parentIdIn: string = '', rootParentId = null) {
        if (!Array.isArray(array) || array.length == 0) {
            return [];
        }


        // 创建节点映射和链表头节点
        const nodeMap = new Map();
        const head = new TreeNode(-1, -1); // 虚拟头节点
        let tail = head;

        // 第一遍：创建所有节点并建立映射
        array.forEach(item => {
            const node = new TreeNode(item.id, parentIdIn? TreeLinkedListSorter.getParentIdObj(item, parentIdIn).parentId : item.parentId, item);
            nodeMap.set(item.id, node);
        });

        // 第二遍：构建树形结构和链表
        array.forEach(item => {
            const node = nodeMap.get(item.id);
            const parentId = parentIdIn? TreeLinkedListSorter.getParentIdObj(item, parentIdIn).parentId : item.parentId;
            if (parentId == rootParentId) {
                // 根节点：添加到链表末尾
                tail.next = node;
                tail = node;
            } else {
                const parent = nodeMap.get(parentId);
                if (parent) {
                    parent.children.push(node);
                } else {
                    // 父节点不存在，作为根节点处理
                tail.next = node;
                tail = node;
                }
            }
        });

        // 对每个节点的子节点按id排序
        function sortChildren(node: TreeNode) {
            if (node.children.length > 0) {
                node.children.sort((a, b) => Number(a.id) - Number(b.id));
                node.children.forEach(child => sortChildren(child));
            }
        }

        // 从虚拟头节点的下一个节点开始排序
        let current = head.next;
        while (current) {
            sortChildren(current);
            current = current.next;
        }

        // 第三遍：深度优先遍历生成排序结果
        const result: ObjectType[] = [];
        
        function traverse(node: TreeNode) {
            if (!node) return;
            
            // 添加当前节点到结果
            result.push({
                id: node.id,
                parentId: node.parentId,
                data: node.data,
            });
            
            // 遍历子节点
            if (node.children.length > 0) {
                node.children.forEach(child => {
                    traverse(child);
                });
            }
        }

        // 遍历链表中的每个根节点
        current = head.next;
        while (current) {
            traverse(current);
            current = current.next;
        }

        return result;
    }

    /**
     * 替代方案：纯链表实现（不使用递归）
     * @param {Array} array - 包含id和parentId的对象数组
     * @param {string} rootParentId - 根节点的parentId值
     * @returns {Array} 排序后的数组
     */
    static sortByHierarchyIterative(array: ObjectType[], parentIdIn: string = '', rootParentId = null) {
        if (!Array.isArray(array) || array.length == 0) {
            return [];
        }

        const nodeMap = new Map();
        const result = [];
        
        // 创建所有节点
        array.forEach(item => {
            let parentId = parentIdIn? TreeLinkedListSorter.getParentIdObj(item, parentIdIn).parentId || null : item.parentId;

            const node = {
                id: item.id,
                parentId: parentId,
                data: item,
                visited: false,
                next: null
            };
            nodeMap.set(item.id, node);
        });

        // 构建层级队列
        const queue: TreeNode[] = [];
        
        // 首先添加所有根节点
        array.forEach(item => {
            let parentId = parentIdIn? TreeLinkedListSorter.getParentIdObj(item, parentIdIn).parentId || null : item.parentId;
            if (parentId == rootParentId) {
                queue.push(nodeMap.get(item.id));
            }
        });

        // 对根节点按id排序
        queue.sort((a, b) => Number(a.id) - Number(b.id));

        // 广度优先遍历
        while (queue.length > 0) {
            const node = queue.shift();
            
            if (node && !node.visited) {
                // let parentId = parentIdIn? TreeLinkedListSorter.getParentIdObj(node, parentIdIn).parentId : node.parentId;

                result.push({
                    id: node.id,
                    parentId: node.parentId,
                    data: node.data,
                });
                node.visited = true;
                
                // 查找当前节点的所有直接子节点
                const children = array
                    .filter(item => {
                        let parentId = parentIdIn? TreeLinkedListSorter.getParentIdObj(item, parentIdIn).parentId || null : item.parentId;
                        return parentId == node.id
                    })
                    .map(item => nodeMap.get(item.id))
                    .sort((a, b) => a.id - b.id);
                
                // 将子节点添加到队列
                queue.push(...children);
            }
        }

        return result;
    }

    /**
     * 打印链表结构（用于调试）
     * @param {TreeNode} head - 链表头节点
     */
    static printLinkedList(head: TreeNode) {
        let current = head.next;
        const nodes = [];
        while (current) {
            nodes.push(current.id);
            current = current.next;
        }
    }
}

// 测试函数
function testTreeLinkedListSorter() {
    const testData = [
        { id: 100, data: { parentId: 200 } },
        { id: 200, data: { parentId: null } },
        { id: 300, data: { parentId: 100 } },
        { id: 400, data: { parentId: 200 } },
        { id: 500, data: { parentId: 100 } },
        { id: 600, data: { parentId: null } },
        { id: 700, data: { parentId: 600 } }
    ];

    console.log('== 树形结构链表排序测试 ==');
    console.log('原始数据:', testData);
    
    // 测试方法1：基于链表的递归实现
    console.log('\n--- 方法1：链表递归实现 ---');
    /**
        排序结果: [
    { id: 200, parentId: null },
    { id: 100, parentId: 200 },
    { id: 300, parentId: 100 },
    { id: 500, parentId: 100 },
    { id: 400, parentId: 200 },
    { id: 600, parentId: null },
    { id: 700, parentId: 600 }
    { id: 700, parentId: 600 }
    ]
     */

    const sorted1 = TreeLinkedListSorter.sortByHierarchy(testData, 'data', null);
    console.log('排序结果:', sorted1);
    
    // 测试方法2：链表迭代实现
    /**
     排序结果: [
    { id: 200, parentId: null },
    { id: 600, parentId: null },
    { id: 100, parentId: 200 },
    { id: 400, parentId: 200 },
    { id: 700, parentId: 600 },
    { id: 300, parentId: 100 },
    { id: 500, parentId: 100 }
    ]
     */
    console.log('\n--- 方法2：链表迭代实现 ---');
    const sorted2 = TreeLinkedListSorter.sortByHierarchyIterative(testData, 'data', null);
    console.log('排序结果:', sorted2);
    
    return { sorted1, sorted2 };
}
